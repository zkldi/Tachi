-- Replace chart_leaderboard VIEW (full-table window agg on every query) with a real table
-- keyed by pb.row_id. Rows are rebuilt per (chart_id, lens) partition when pb changes,
-- using AFTER STATEMENT triggers so bulk INSERT touches each partition at most once.
--
-- Matches genesis leaderboard ordering (rank tie-breakers + time_achieved ASC NULLS LAST).
-- After migrate: regenerate DB types from your checkout (see db/kanel_config.js).

CREATE TABLE chart_leaderboard_new (
	row_id UUID PRIMARY KEY REFERENCES pb (row_id) ON DELETE CASCADE,
	rank BIGINT NOT NULL,
	out_of BIGINT NOT NULL
);

INSERT INTO chart_leaderboard_new (row_id, rank, out_of)
SELECT
	row_id,
	RANK() OVER (
		PARTITION BY chart_id, lens
		ORDER BY
			ranking_value DESC NULLS LAST,
			ranking_value_tb1 DESC NULLS LAST,
			ranking_value_tb2 DESC NULLS LAST,
			ranking_value_tb3 DESC NULLS LAST,
			ranking_value_tb4 DESC NULLS LAST,
			ranking_value_tb5 DESC NULLS LAST,
			time_achieved ASC NULLS LAST
	) AS rank,
	COUNT(*) OVER (PARTITION BY chart_id, lens) AS out_of
FROM pb;

DROP VIEW chart_leaderboard;

ALTER TABLE chart_leaderboard_new RENAME TO chart_leaderboard;

COMMENT ON TABLE chart_leaderboard IS
	'Cached global rank / out_of per pb row for PARTITION BY (chart_id, lens). Maintained by triggers on pb; ordering matches genesis chart_leaderboard view.';

CREATE FUNCTION refresh_chart_leaderboard_partition (
	p_chart_id TEXT,
	p_lens TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	DELETE FROM chart_leaderboard cl
	USING pb
	WHERE
		cl.row_id = pb.row_id
		AND pb.chart_id = p_chart_id
		AND pb.lens IS NOT DISTINCT FROM p_lens;

	INSERT INTO chart_leaderboard (row_id, rank, out_of)
	SELECT
		pb.row_id,
		RANK() OVER (
			PARTITION BY pb.chart_id, pb.lens
			ORDER BY
				pb.ranking_value DESC NULLS LAST,
				pb.ranking_value_tb1 DESC NULLS LAST,
				pb.ranking_value_tb2 DESC NULLS LAST,
				pb.ranking_value_tb3 DESC NULLS LAST,
				pb.ranking_value_tb4 DESC NULLS LAST,
				pb.ranking_value_tb5 DESC NULLS LAST,
				pb.time_achieved ASC NULLS LAST
		) AS rank,
		COUNT(*) OVER (PARTITION BY pb.chart_id, pb.lens) AS out_of
	FROM pb
	WHERE
		pb.chart_id = p_chart_id
		AND pb.lens IS NOT DISTINCT FROM p_lens;
END;
$$;

CREATE FUNCTION refresh_leaderboard_stmt_after_pb_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM refresh_chart_leaderboard_partition (d.chart_id, d.lens)
	FROM (
		SELECT DISTINCT
			chart_id,
			lens
		FROM pb_inserted
	) AS d;

	RETURN NULL;
END;
$$;

CREATE FUNCTION refresh_leaderboard_stmt_after_pb_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM refresh_chart_leaderboard_partition (d.chart_id, d.lens)
	FROM (
		SELECT DISTINCT
			chart_id,
			lens
		FROM pb_updated_old
		UNION
		SELECT DISTINCT
			chart_id,
			lens
		FROM pb_updated_new
	) AS d;

	RETURN NULL;
END;
$$;

CREATE FUNCTION refresh_leaderboard_stmt_after_pb_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	PERFORM refresh_chart_leaderboard_partition (d.chart_id, d.lens)
	FROM (
		SELECT DISTINCT
			chart_id,
			lens
		FROM pb_deleted
	) AS d;

	RETURN NULL;
END;
$$;

CREATE TRIGGER pb_leaderboard_ai
	AFTER INSERT ON pb
	REFERENCING NEW TABLE AS pb_inserted
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_leaderboard_stmt_after_pb_insert();

CREATE TRIGGER pb_leaderboard_au
	AFTER UPDATE ON pb
	REFERENCING OLD TABLE AS pb_updated_old NEW TABLE AS pb_updated_new
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_leaderboard_stmt_after_pb_update();

CREATE TRIGGER pb_leaderboard_ad
	AFTER DELETE ON pb
	REFERENCING OLD TABLE AS pb_deleted
	FOR EACH STATEMENT
	EXECUTE FUNCTION refresh_leaderboard_stmt_after_pb_delete();

ANALYZE chart_leaderboard;
