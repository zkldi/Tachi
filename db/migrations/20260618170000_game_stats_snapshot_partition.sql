-- Convert `game_stats_snapshot` to a monthly range-partitioned table.
--
-- This migration only handles the structural change (rename old table, create the new
-- partitioned table, configure pg_partman).  The data copy is a separate migration
-- (20260618180000) so that the two steps can be reasoned about independently and the
-- data migration can be re-run or batched manually on prod if the table is very large.
--
-- Historical data goes back to 2021-12, so we ask pg_partman to pre-create partitions
-- from that date forward.

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
    p_parent_table    => 'public.game_stats_snapshot',
    p_control         => 'timestamp',
    p_interval        => '1 month',
    p_premake         => 3,
    p_start_partition => '2021-12-01'
);

-- All historical data is valuable — no automatic partition drops.
UPDATE partman.part_config
SET    retention = NULL
WHERE  parent_table = 'public.game_stats_snapshot';
