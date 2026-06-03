-- The score dirty-queue triggers used to run once per row. During large
-- rederive/import UPDATEs, parallel transactions could insert overlapping
-- session_dirty / pb_dirty / game_profile_dirty keys in different row orders
-- and deadlock inside the unique indexes despite ON CONFLICT DO NOTHING.
--
-- Use AFTER STATEMENT transition tables instead: each statement inserts each
-- dirty key once, in deterministic key order.

DROP TRIGGER "score_pb_dirty" ON score;
DROP TRIGGER "score_session_dirty" ON score;
DROP TRIGGER "score_game_profile_dirty" ON score;

DROP FUNCTION enqueue_pb_dirty();
DROP FUNCTION enqueue_session_dirty();
DROP FUNCTION enqueue_game_profile_dirty();

CREATE FUNCTION enqueue_pb_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		INSERT INTO pb_dirty (user_id, chart_id)
		SELECT DISTINCT
			score_deleted.user_id,
			score_deleted.chart_id
		FROM score_deleted
		ORDER BY score_deleted.user_id, score_deleted.chart_id
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO pb_dirty (user_id, chart_id)
		SELECT DISTINCT
			d.user_id,
			d.chart_id
		FROM (
			SELECT
				score_updated_old.user_id,
				score_updated_old.chart_id
			FROM score_updated_old
			UNION
			SELECT
				score_updated_new.user_id,
				score_updated_new.chart_id
			FROM score_updated_new
		) AS d
		ORDER BY d.user_id, d.chart_id
		ON CONFLICT DO NOTHING;
	ELSE
		INSERT INTO pb_dirty (user_id, chart_id)
		SELECT DISTINCT
			score_inserted.user_id,
			score_inserted.chart_id
		FROM score_inserted
		ORDER BY score_inserted.user_id, score_inserted.chart_id
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NULL;
END;
$$;

CREATE FUNCTION enqueue_session_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		INSERT INTO session_dirty (session_id)
		SELECT DISTINCT score_deleted.session_id
		FROM score_deleted
		WHERE
			score_deleted.committed
			AND score_deleted.session_id IS NOT NULL
		ORDER BY score_deleted.session_id
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO session_dirty (session_id)
		SELECT DISTINCT d.session_id
		FROM (
			SELECT score_updated_old.session_id
			FROM score_updated_old
			WHERE
				score_updated_old.committed
				AND score_updated_old.session_id IS NOT NULL
			UNION
			SELECT score_updated_new.session_id
			FROM score_updated_new
			WHERE
				score_updated_new.committed
				AND score_updated_new.session_id IS NOT NULL
		) AS d
		ORDER BY d.session_id
		ON CONFLICT DO NOTHING;
	ELSE
		INSERT INTO session_dirty (session_id)
		SELECT DISTINCT score_inserted.session_id
		FROM score_inserted
		WHERE
			score_inserted.committed
			AND score_inserted.session_id IS NOT NULL
		ORDER BY score_inserted.session_id
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NULL;
END;
$$;

CREATE FUNCTION enqueue_game_profile_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT DISTINCT
			score_deleted.user_id,
			score_deleted.game
		FROM score_deleted
		WHERE score_deleted.committed
		ORDER BY score_deleted.user_id, score_deleted.game
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT DISTINCT
			d.user_id,
			d.game
		FROM (
			SELECT
				score_updated_old.user_id,
				score_updated_old.game
			FROM score_updated_old
			WHERE score_updated_old.committed
			UNION
			SELECT
				score_updated_new.user_id,
				score_updated_new.game
			FROM score_updated_new
			WHERE score_updated_new.committed
		) AS d
		ORDER BY d.user_id, d.game
		ON CONFLICT DO NOTHING;
	ELSE
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT DISTINCT
			score_inserted.user_id,
			score_inserted.game
		FROM score_inserted
		WHERE score_inserted.committed
		ORDER BY score_inserted.user_id, score_inserted.game
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NULL;
END;
$$;

CREATE TRIGGER "score_pb_dirty"
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_pb_dirty();

CREATE TRIGGER "score_pb_dirty_update"
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_pb_dirty();

CREATE TRIGGER "score_pb_dirty_delete"
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_pb_dirty();

CREATE TRIGGER "score_session_dirty"
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_update"
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_delete"
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_game_profile_dirty"
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_update"
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_delete"
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT
	EXECUTE FUNCTION enqueue_game_profile_dirty();
