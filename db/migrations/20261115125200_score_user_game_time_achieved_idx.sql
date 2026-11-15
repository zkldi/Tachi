CREATE INDEX IF NOT EXISTS score_user_game_time_achieved_idx
ON public.raw_score USING btree (user_id, game, time_achieved DESC NULLS LAST)
WHERE committed = true;
