CREATE OR REPLACE FUNCTION refresh_leaderboard_stmt_after_pb_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Only rebuild partitions whose leaderboard ordering actually changed. The
    -- ordering columns mirror refresh_chart_leaderboard_partition's ORDER BY, so a
    -- non-ranking update (e.g. rivalRank in calculated_data, highlight) leaves the
    -- leaderboard intact and is skipped entirely. row_id is pb's PK and is never
    -- mutated on UPDATE, so OLD and NEW transition rows pair up 1:1.
    --
    -- NOTE: this assumes an UPDATE never changes a row's (chart_id, lens), i.e. a
    -- pb never moves between partitions. That holds today (updates only touch score
    -- data). If a partition-moving UPDATE is ever introduced, this must also refresh
    -- the partition the row left, or the old partition's cached ranks go stale.
    PERFORM refresh_chart_leaderboard_partition (d.chart_id, d.lens)
    FROM (
        SELECT DISTINCT
            n.chart_id,
            n.lens
        FROM pb_updated_new n
        JOIN pb_updated_old o ON o.row_id = n.row_id
        WHERE n.ranking_value IS DISTINCT FROM o.ranking_value
           OR n.ranking_value_tb1 IS DISTINCT FROM o.ranking_value_tb1
           OR n.ranking_value_tb2 IS DISTINCT FROM o.ranking_value_tb2
           OR n.ranking_value_tb3 IS DISTINCT FROM o.ranking_value_tb3
           OR n.ranking_value_tb4 IS DISTINCT FROM o.ranking_value_tb4
           OR n.ranking_value_tb5 IS DISTINCT FROM o.ranking_value_tb5
           OR n.time_achieved IS DISTINCT FROM o.time_achieved
    ) AS d;

    RETURN NULL;
END;
$$;
