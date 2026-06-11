-- Row-level inserts can cause deadlocks when combined with concurrency. For instance,
-- take two tasks T1 = rederiveScoresForChart(C1) and T2 = rederiveScoresForChart(C2).
--
-- If C1 and C2 shares the same session S1 and S2, this can happen:
-- * T1 updates score on (S1, C1), which triggers an insert to session_dirty for S1, but
-- transaction is not committed yet
-- * T2 updates score on (S1, C2), which triggers an insert to session_dirty for S1, but
-- Postgres finds that T1 has already done that, so Postgres makes T2 wait on T1's completion
-- * Now, if the reverse happens for S2 (aka T2 inserts S2 before T1), Postgres will now make
-- T1 wait for T2's completion, causing a deadlock!
--
-- The solution is to enqueue all dirty sessions/game profiles/pbs in one go by using statement
-- level triggers instead of row-level triggers, and insert the dirty keys **in sorted order**.
-- Inserting the dirty keys in sorted order ensures that there are no waiting cycles. For example,
-- have T1 insert A, B, C, D and T2 insert C, D, E, F. When T1 tries to acquire C, it finds that
-- T2 has held the lock on C earlier, so it has to wait for T2 to fully complete before continuing
-- => no deadlocks.

DROP TRIGGER "score_pb_dirty" ON "score";
DROP TRIGGER "score_session_dirty" ON "score";
DROP TRIGGER "score_game_profile_dirty" ON "score";

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
        ORDER BY score_new.user_id, score_new.chart_id
        ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_pb_dirty_ai"
    AFTER INSERT ON "score"
    REFERENCING NEW TABLE AS score_new
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_pb_dirty();

CREATE TRIGGER "score_pb_dirty_au"
    AFTER UPDATE ON "score"
    REFERENCING NEW TABLE AS score_new
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_pb_dirty();

CREATE TRIGGER "score_pb_dirty_ad"
    AFTER DELETE ON "score"
    REFERENCING OLD TABLE AS score_old
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_pb_dirty();

CREATE OR REPLACE FUNCTION enqueue_session_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
        INSERT INTO session_dirty (session_id)
        SELECT DISTINCT score_old.session_id
        FROM score_old
        WHERE score_old.committed AND score_old.session_id IS NOT NULL
        ORDER BY score_old.session_id
        ON CONFLICT DO NOTHING;
	ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO session_dirty (session_id)
        SELECT DISTINCT s.session_id
        FROM (
            SELECT score_old.session_id AS session_id
            FROM score_old
            INNER JOIN score_new ON score_old.id = score_new.id
            WHERE score_new.committed
                AND score_old.session_id IS NOT NULL
                AND score_old.session_id IS DISTINCT FROM score_new.session_id
            UNION
            SELECT score_new.session_id AS session_id
            FROM score_new
            WHERE score_new.committed AND score_new.session_id IS NOT NULL
        ) s
        ORDER BY s.session_id
        ON CONFLICT DO NOTHING;
	ELSE
        INSERT INTO session_dirty (session_id)
        SELECT score_new.session_id
        FROM score_new
        WHERE score_new.committed AND score_new.session_id IS NOT NULL
        ORDER BY score_new.session_id
        ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_session_dirty_ai"
    AFTER INSERT ON "score"
    REFERENCING NEW TABLE AS score_new
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_au"
    AFTER UPDATE ON "score"
    REFERENCING OLD TABLE AS score_old NEW TABLE AS score_new
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE TRIGGER "score_session_dirty_ad"
    AFTER DELETE ON "score"
    REFERENCING OLD TABLE AS score_old
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_session_dirty();

CREATE OR REPLACE FUNCTION enqueue_game_profile_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
        INSERT INTO game_profile_dirty (user_id, game)
        SELECT DISTINCT score_old.user_id, score_old.game
        FROM score_old
        WHERE score_old.committed
        ORDER BY score_old.user_id, score_old.game
        ON CONFLICT DO NOTHING;
	ELSE
        INSERT INTO game_profile_dirty (user_id, game)
        SELECT DISTINCT score_new.user_id, score_new.game
        FROM score_new
        WHERE score_new.committed
        ORDER BY score_new.user_id, score_new.game
        ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_game_profile_dirty_ai"
    AFTER INSERT ON "score"
    REFERENCING NEW TABLE AS score_new
	FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_au"
    AFTER UPDATE ON "score"
    REFERENCING NEW TABLE AS score_new
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();

CREATE TRIGGER "score_game_profile_dirty_ad"
    AFTER DELETE ON "score"
    REFERENCING OLD TABLE AS score_old
    FOR EACH STATEMENT EXECUTE FUNCTION enqueue_game_profile_dirty();
