-- Speed up per-game score aggregates grouped by chart (GET /games/:game/charts popularity).
CREATE INDEX IF NOT EXISTS score_game_chart_id_idx ON public.score USING btree (game, chart_id);
