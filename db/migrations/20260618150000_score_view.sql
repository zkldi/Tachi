-- Replace the `score` table with a view that only surfaces committed rows.
-- This ensures all public API queries automatically see committed-only scores,
-- while import-internal code can write/read staged rows via `raw_score` directly.
--
-- Postgres carries all indexes, constraints, triggers, and FK references along
-- with the renamed table automatically (they track by OID, not name).

ALTER TABLE score RENAME TO raw_score;

CREATE VIEW score AS
    SELECT * FROM raw_score WHERE committed = true;
