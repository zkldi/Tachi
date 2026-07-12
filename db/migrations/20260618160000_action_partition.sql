-- Convert `action` to a monthly range-partitioned table managed by pg_partman.
--
-- Strategy: rename the existing unpartitioned table, recreate it as PARTITION BY RANGE,
-- let pg_partman build the child partitions, copy the existing rows in, then drop the
-- old table.  Safe to do in one migration because `action` is small (~120 k rows in
-- prod, no inbound foreign keys) and all reads/writes are blocked during the migration
-- anyway by the lock on the renamed table.
--
-- pg_partman must be installed on the server before this migration runs:
--   apt-get install postgresql-18-partman
--   CREATE EXTENSION pg_partman SCHEMA partman;   -- or let postgres-init.sql do it

CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

ALTER TABLE action RENAME TO action_unpartitioned;

CREATE TABLE action (
    row_id   UUID          DEFAULT uuidv7() NOT NULL,
    user_id  BIGINT        REFERENCES account(id),
    ip       INET,
    app      TEXT          NOT NULL,
    kind     TEXT          NOT NULL,
    result   ACTION_RESULT NOT NULL,
    input    JSONB         NOT NULL,
    output   JSONB,
    ts_start TIMESTAMPTZ   NOT NULL,
    ts_end   TIMESTAMPTZ   NOT NULL,
    -- Partition key must be part of the PK in Postgres partitioned tables.
    PRIMARY KEY (row_id, ts_start)
) PARTITION BY RANGE (ts_start);

-- Indexes on the parent are inherited by every child partition pg_partman creates.
CREATE INDEX ON action (user_id, ts_start DESC);
CREATE INDEX ON action (ip,      ts_start DESC);
CREATE INDEX ON action (app, kind, ts_start DESC);

SELECT partman.create_parent(
    p_parent_table    => 'public.action',
    p_control         => 'ts_start',
    p_interval        => '1 month',
    p_premake         => 3,
    p_start_partition => (
        SELECT COALESCE(MIN(ts_start), NOW())::date::text
        FROM action_unpartitioned
    )
);

-- Keep 24 months of action logs; older partitions are dropped on maintenance runs.
UPDATE partman.part_config
SET    retention            = '24 months',
       retention_keep_table = false
WHERE  parent_table = 'public.action';

-- Migrate existing rows.
INSERT INTO action SELECT * FROM action_unpartitioned;

DROP TABLE action_unpartitioned;

-- Redistribute any rows that landed in the DEFAULT partition into proper monthly slices.
DO $$
DECLARE
    moved BIGINT;
BEGIN
    LOOP
        SELECT partman.partition_data_time('public.action', p_batch_count => 1000)
        INTO moved;
        EXIT WHEN moved = 0;
    END LOOP;
END $$;
