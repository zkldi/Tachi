-- Copy data from the unpartitioned game_stats_snapshot_old into the new partitioned
-- game_stats_snapshot table created by migration 20260618170000.
--
-- On prod this covers ~4.7 M rows (1.3 GB).  The INSERT is safe to run in the migration
-- runner; on very large prod instances it can also be done manually in batches with
-- partman.partition_data_time() before deploying, then just DROP the old table here.

INSERT INTO game_stats_snapshot SELECT * FROM game_stats_snapshot_old;

DROP TABLE game_stats_snapshot_old;
