-- Cached total score count per chart. Maintained by AFTER STATEMENT triggers on score
-- (batch increment/decrement per statement, same pattern as chart_leaderboard on pb).
-- After migrate: regenerate DB types from your checkout (see db/kanel_config.js).

CREATE TABLE chart_playcount (
	chart_id TEXT PRIMARY KEY REFERENCES chart (id) ON DELETE CASCADE,
	playcount INT NOT NULL DEFAULT 0 CHECK (playcount >= 0)
);

CREATE INDEX chart_playcount_playcount_idx ON chart_playcount USING btree (playcount DESC);

COMMENT ON TABLE chart_playcount IS
	'Cached total score rows per chart. Maintained by AFTER STATEMENT triggers on score.';

INSERT INTO chart_playcount (chart_id, playcount)
SELECT
	score.chart_id,
	COUNT(*)::int AS playcount
FROM score
GROUP BY score.chart_id;

CREATE FUNCTION apply_chart_playcount_delta (
	p_chart_id TEXT,
	p_delta INT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF p_delta = 0 THEN
		RETURN;
	END IF;

	IF p_delta > 0 THEN
		INSERT INTO chart_playcount AS cp (chart_id, playcount)
		VALUES (p_chart_id, p_delta)
		ON CONFLICT (chart_id) DO UPDATE
		SET playcount = cp.playcount + EXCLUDED.playcount;
	ELSE
		UPDATE chart_playcount
		SET playcount = playcount + p_delta
		WHERE chart_id = p_chart_id;

		DELETE FROM chart_playcount
		WHERE chart_id = p_chart_id AND playcount <= 0;
	END IF;
END;
$$;

CREATE FUNCTION refresh_playcount_stmt_after_score_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM apply_chart_playcount_delta(d.chart_id, d.cnt)
	FROM (
		SELECT
			score_inserted.chart_id,
			COUNT(*)::int AS cnt
		FROM score_inserted
		GROUP BY score_inserted.chart_id
	) AS d;

	RETURN NULL;
END;
$$;

CREATE FUNCTION refresh_playcount_stmt_after_score_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM apply_chart_playcount_delta(d.chart_id, -d.cnt)
	FROM (
		SELECT
			score_deleted.chart_id,
			COUNT(*)::int AS cnt
		FROM score_deleted
		GROUP BY score_deleted.chart_id
	) AS d;

	RETURN NULL;
END;
$$;

CREATE FUNCTION refresh_playcount_stmt_after_score_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM apply_chart_playcount_delta(d.chart_id, -d.cnt)
	FROM (
		SELECT
			score_updated_old.chart_id,
			COUNT(*)::int AS cnt
		FROM score_updated_old
		INNER JOIN score_updated_new ON score_updated_old.id = score_updated_new.id
		WHERE score_updated_old.chart_id IS DISTINCT FROM score_updated_new.chart_id
		GROUP BY score_updated_old.chart_id
	) AS d;

	PERFORM apply_chart_playcount_delta(d.chart_id, d.cnt)
	FROM (
		SELECT
			score_updated_new.chart_id,
			COUNT(*)::int AS cnt
		FROM score_updated_old
		INNER JOIN score_updated_new ON score_updated_old.id = score_updated_new.id
		WHERE score_updated_old.chart_id IS DISTINCT FROM score_updated_new.chart_id
		GROUP BY score_updated_new.chart_id
	) AS d;

	RETURN NULL;
END;
$$;

CREATE TRIGGER score_playcount_ai
	AFTER INSERT ON score
	REFERENCING NEW TABLE AS score_inserted
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_playcount_stmt_after_score_insert();

CREATE TRIGGER score_playcount_ad
	AFTER DELETE ON score
	REFERENCING OLD TABLE AS score_deleted
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_playcount_stmt_after_score_delete();

CREATE TRIGGER score_playcount_au
	AFTER UPDATE ON score
	REFERENCING OLD TABLE AS score_updated_old NEW TABLE AS score_updated_new
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_playcount_stmt_after_score_update();

ANALYZE chart_playcount;
