-- Row-level dirty-queue triggers can deadlock during parallel score re-derivation.
--
-- `drainScoreRederive` updates many scores for several charts concurrently. When two
-- charts share sessions, the old row trigger inserted into `session_dirty` one score at
-- a time, so concurrent transactions could lock the same primary-key entries in
-- different orders. Use statement-level transition tables instead: each score UPDATE
-- statement inserts the distinct dirty keys once, in deterministic order.

DROP TRIGGER IF EXISTS "score_session_dirty" ON score;
DROP TRIGGER IF EXISTS "score_game_profile_dirty" ON score;

CREATE OR REPLACE FUNCTION enqueue_session_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO session_dirty (session_id)
		SELECT s.session_id
		FROM (
			SELECT DISTINCT si.session_id
			FROM score_inserted AS si
			WHERE
				si.committed
				AND si.session_id IS NOT NULL
		) AS s
		ORDER BY s.session_id
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO session_dirty (session_id)
		SELECT s.session_id
		FROM (
			SELECT suo.session_id
			FROM score_updated_old AS suo
			INNER JOIN score_updated_new AS sun ON sun.id = suo.id
			WHERE
				sun.committed
				AND suo.session_id IS NOT NULL
				AND suo.session_id IS DISTINCT FROM sun.session_id

			UNION

			SELECT sun.session_id
			FROM score_updated_new AS sun
			WHERE
				sun.committed
				AND sun.session_id IS NOT NULL
		) AS s
		ORDER BY s.session_id
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'DELETE' THEN
		INSERT INTO session_dirty (session_id)
		SELECT s.session_id
		FROM (
			SELECT DISTINCT sd.session_id
			FROM score_deleted AS sd
			WHERE
				sd.committed
				AND sd.session_id IS NOT NULL
		) AS s
		ORDER BY s.session_id
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enqueue_game_profile_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT g.user_id, g.game
		FROM (
			SELECT DISTINCT si.user_id, si.game
			FROM score_inserted AS si
			WHERE si.committed
		) AS g
		ORDER BY g.user_id, g.game
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT g.user_id, g.game
		FROM (
			SELECT DISTINCT sun.user_id, sun.game
			FROM score_updated_new AS sun
			WHERE sun.committed
		) AS g
		ORDER BY g.user_id, g.game
		ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'DELETE' THEN
		INSERT INTO game_profile_dirty (user_id, game)
		SELECT g.user_id, g.game
		FROM (
			SELECT DISTINCT sd.user_id, sd.game
			FROM score_deleted AS sd
			WHERE sd.committed
		) AS g
		ORDER BY g.user_id, g.game
		ON CONFLICT DO NOTHING;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_session_dirty_ai"
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_au"
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_ad"
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_game_profile_dirty_ai"
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_au"
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_ad"
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();
