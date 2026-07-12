-- Session list endpoints filter scores by session_id; partial index omits NULL session rows.
CREATE INDEX IF NOT EXISTS score_session_id_idx ON public.score USING btree (session_id)
WHERE session_id IS NOT NULL;
