-- Convert `game_stats_snapshot` to a monthly range-partitioned table.
--
-- This migration only handles the structural change (rename old table, create the new
-- partitioned table, configure pg_partman).  The data copy is a separate migration
-- (20260618180000) so that the two steps can be reasoned about independently and the
-- data migration can be re-run or batched manually on prod if the table is very large.
--
-- pg_partman creates partitions centred on NOW() (+/- p_premake months).  Historical
-- rows inserted by the copy migration land in the DEFAULT partition; run
--   SELECT partman.partition_data_time('public.game_stats_snapshot');
-- on prod after deploying to move them into proper monthly partitions.  This avoids
-- pre-creating ~55 empty historical partitions in every CI/fresh-install DB.

ALTER TABLE game_stats_snapshot RENAME TO game_stats_snapshot_old;

CREATE TABLE game_stats_snapshot (
    user_id   BIGINT      REFERENCES account(id) NOT NULL,
    game      GAME        NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    playcount BIGINT      NOT NULL,
    ratings   JSONB       NOT NULL,
    classes   JSONB       NOT NULL,
    rankings  JSONB       NOT NULL,
    PRIMARY KEY (user_id, game, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE INDEX ON game_stats_snapshot (game, timestamp DESC);

SELECT partman.create_parent(
    p_parent_table => 'public.game_stats_snapshot',
    p_control      => 'timestamp',
    p_interval     => '1 month',
    p_premake      => 3
);

-- All historical data is valuable — no automatic partition drops.
UPDATE partman.part_config
SET    retention = NULL
WHERE  parent_table = 'public.game_stats_snapshot';
