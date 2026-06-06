CREATE INDEX IF NOT EXISTS score_import_id_idx ON public.score USING btree (import_id);
CREATE INDEX IF NOT EXISTS import_error_import_id_idx ON public.import_error USING btree (import_id);
CREATE INDEX IF NOT EXISTS import_class_import_id_idx ON public.import_class USING btree (import_id);
