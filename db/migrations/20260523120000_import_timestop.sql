CREATE TABLE import_timestop (
	user_id         BIGINT      NOT NULL REFERENCES account(id),
	import_type     IMPORT_TYPE NOT NULL,
	last_score_time TIMESTAMPTZ NOT NULL,
	PRIMARY KEY (user_id, import_type)
);
