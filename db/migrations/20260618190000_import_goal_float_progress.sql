-- Goal progress and out_of values are floating point (e.g. BPI, rating-based thresholds).
-- The integer columns silently truncated or hard-failed inserts, rolling back every import
-- transaction that touched goals and leaving all staged scores committed=false.

ALTER TABLE import_goal
    ALTER COLUMN prev_progress   TYPE double precision,
    ALTER COLUMN new_progress    TYPE double precision,
    ALTER COLUMN prev_out_of     TYPE double precision,
    ALTER COLUMN new_out_of      TYPE double precision;
