-- Only committed scores should mark PBs dirty on insert/update (staging scores are invisible
-- to async drains). Deletes always enqueue: a removed score may have been merged into the
-- current PB (including staging scores written during a failed import).
CREATE OR REPLACE FUNCTION enqueue_pb_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
        INSERT INTO pb_dirty (user_id, chart_id)
        SELECT DISTINCT score_old.user_id, score_old.chart_id
        FROM score_old
        ORDER BY score_old.user_id, score_old.chart_id
		ON CONFLICT DO NOTHING;
	ELSE
		INSERT INTO pb_dirty (user_id, chart_id)
		SELECT DISTINCT score_new.user_id, score_new.chart_id
        FROM score_new
        WHERE score_new.committed
        ORDER BY score_new.user_id, score_new.chart_id
        ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- When a calculation run finishes, last_clean_started_at records when that run *started*.
-- Writers only apply if their runStartedAt is >= the row's last_clean_started_at (stale runs lose).
ALTER TABLE pb ADD COLUMN last_clean_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE session ADD COLUMN last_clean_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE game_profile ADD COLUMN last_clean_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
