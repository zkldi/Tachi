CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Query stats (requires shared_preload_libraries=pg_stat_statements; see docker-compose-dev.yml).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- auto_explain is loaded via shared_preload_libraries in dev (same docker-compose).

-- Tables starting with "priv_" are private and should never ever be exposed
-- everything else is assumed to be sound, public information.

-- ==> Enums
CREATE TYPE auth_level AS ENUM ('banned', 'user', 'admin');
CREATE TYPE account_badge_kind AS ENUM ('beta', 'alpha', 'dev-team');
CREATE TYPE game AS ENUM (
	'iidx-sp',
	'iidx-dp',
	'museca',
	'sdvx',
	'bms-14k',
	'bms-7k',
	'gitadora-dora',
	'gitadora-gita',
	'chunithm',
	'wacca',
	'jubeat',
	'popn',
	'maimai',
	'maimaidx',
	'pms-controller',
	'pms-keyboard',
	'usc-controller',
	'usc-keyboard',
	'itg-stamina',
	'arcaea',
	'ongeki',
	'ddr-sp',
	'ddr-dp'
);
CREATE TYPE import_type AS ENUM (
	'file/batch-manual',
	'file/eamusement-iidx-csv',
	'file/eamusement-sdvx-csv',
	'file/mypagescraper-player-csv',
	'file/mypagescraper-records-csv',
	'file/pli-iidx-csv',
	'file/solid-state-squad',

	'api/arc-iidx', -- REMOVED import type OMGWTFBBQ
	'api/arc-sdvx', -- REMOVED import type OMGWTFBBQ
	'api/mer-iidx', -- REMOVED import type OMGWTFBBQ
	'api/eag-iidx',
	'api/eag-sdvx',
	'api/flo-iidx',
	'api/flo-sdvx',
	'api/min-sdvx',
	'api/myt-chunithm',
	'api/myt-maimaidx',
	'api/myt-ongeki',
	'api/myt-wacca',
	'api/cg-dev-jubeat',
	'api/cg-dev-museca',
	'api/cg-dev-popn',
	'api/cg-dev-sdvx',
	'api/cg-gan-jubeat',
	'api/cg-gan-museca',
	'api/cg-gan-popn',
	'api/cg-gan-sdvx',
	'api/cg-nag-jubeat',
	'api/cg-nag-museca',
	'api/cg-nag-popn',
	'api/cg-nag-sdvx',

	'ir/barbatos',
	'ir/beatoraja',
	'ir/direct-manual',
	'ir/fervidex-static',
	'ir/fervidex',
	'ir/kshook-sv6c-static',
	'ir/kshook-sv6c',
	'ir/lr2hook',
	'ir/usc'
);

-- A game group is used for songs; it is a grouping for games
-- that logically re-use song data and share them between multiple
-- sub games. This is rare, but the only real example is SP/DP
-- in IIDX and DDR.
CREATE TYPE game_group AS ENUM (
	'iidx',
	'museca',
	'chunithm',
	'bms',
	'gitadora',
	'jubeat',
	'maimai',
	'maimaidx',
	'popn',
	'sdvx',
	'usc',
	'wacca',
	'pms',
	'itg',
	'arcaea',
	'ongeki',
	'ddr'
);

-- <== End enums

-- ==> Essentials for Zenith-style infrastructure

-- This is our postgres-backed job queue.
-- https://kerkour.com/rust-job-queue-with-postgresql
CREATE TABLE "job_queue" (
	row_id UUID PRIMARY KEY DEFAULT uuidv7(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	
	scheduled_for TIMESTAMPTZ NOT NULL,
	failed_attempts INT NOT NULL DEFAULT 0,
	status INT NOT NULL,

	scope TEXT NOT NULL,
	job_kind TEXT NOT NULL,

	payload JSONB NOT NULL
);
CREATE INDEX job_queue_partial_index_btree
ON job_queue (created_at, status)
WHERE status = 0;
CREATE INDEX job_queue_dequeue_idx
ON job_queue (scheduled_for ASC, created_at ASC)
WHERE status = 0;

CREATE TABLE "cron_task" (
	id TEXT PRIMARY KEY,
	schedule TEXT NOT NULL,
	description TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	-- The cron fire time of the last run we dispatched. Used to determine
	-- what is due on the next tick, and to implement skip-missed-run semantics.
	last_scheduled_at TIMESTAMPTZ
);

CREATE TABLE "cron_task_execution" (
	id BIGSERIAL PRIMARY KEY,
	task_id TEXT NOT NULL,

	-- The cron fire time this execution corresponds to (not the wall time it started).
	scheduled_at TIMESTAMPTZ NOT NULL,

	started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	completed_at TIMESTAMPTZ,

	status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure')),
	output TEXT,
	error TEXT
);

-- this table is likely to be made by the migration engine
-- so this code will likely never proc.
CREATE TABLE IF NOT EXISTS "_migration" (
	version BIGINT NOT NULL,
	description TEXT NOT NULL,
	installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	success BOOLEAN NOT NULL,
	checksum BYTEA NOT NULL,
	execution_time BIGINT NOT NULL
);

-- <== End essentials

CREATE TABLE "account" (
	id BIGSERIAL PRIMARY KEY,

	username TEXT UNIQUE NOT NULL,
	normalized_username TEXT GENERATED ALWAYS AS (LOWER(username)) STORED UNIQUE NOT NULL,

	sm_discord TEXT,
	sm_twitter TEXT,
	sm_github TEXT,
	sm_steam TEXT,
	sm_youtube TEXT,
	sm_twitch TEXT,

	bd_alpha BOOLEAN NOT NULL DEFAULT FALSE,
	bd_beta BOOLEAN NOT NULL DEFAULT FALSE,
	bd_dev_team BOOLEAN NOT NULL DEFAULT FALSE,

	joined TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	about TEXT CHECK (LENGTH(about) <= 2000) NOT NULL,
	status TEXT CHECK (LENGTH(status) <= 140),

	custom_pfp_location TEXT,
	custom_banner_location TEXT,

	last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	auth_level AUTH_LEVEL NOT NULL DEFAULT 'user',
	is_supporter BOOLEAN NOT NULL DEFAULT FALSE
);

-- ==> Another Zenith Essential
CREATE TYPE action_result AS ENUM ('GOOD', 'BAD', 'THROW');

CREATE TABLE "action" (
	row_id UUID PRIMARY KEY DEFAULT uuidv7(),
	user_id BIGINT REFERENCES account(id),
	ip INET,
	app TEXT NOT NULL,
	kind TEXT NOT NULL,
	result ACTION_RESULT NOT NULL,
	input JSONB NOT NULL,
	output JSONB,

	-- start/end lets you work out action durations
	ts_start TIMESTAMPTZ NOT NULL,
	ts_end TIMESTAMPTZ NOT NULL
);
-- TODO Partition this table

CREATE INDEX ON "action" (user_id, ts_start DESC);
CREATE INDEX ON "action" (ip, ts_start DESC);
CREATE INDEX ON "action" (app, kind, ts_start DESC);
-- <== End another Zenith Essential

CREATE TABLE "account_settings" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	pf_invisible BOOLEAN NOT NULL,
	pf_developer_mode BOOLEAN NOT NULL,
	-- TODO(zk): Unused, can be ripped out
	pf_advanced_mode BOOLEAN NOT NULL,
	-- TODO(zk): Unused, can be ripped out
	pf_contentious_content BOOLEAN NOT NULL,
	pf_deletable_scores BOOLEAN NOT NULL
);

CREATE TABLE "account_following" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	followee BIGINT REFERENCES account(id) NOT NULL,

	PRIMARY KEY (user_id, followee),
	CHECK (user_id != followee)
);

CREATE TABLE "account_username_change" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),

	user_id BIGINT REFERENCES account(id) NOT NULL,
	username TEXT NOT NULL,
	previous_username TEXT NOT NULL,
	timestamp TIMESTAMPTZ NOT NULL
);

CREATE TABLE "priv_account_credential" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	-- bcrypt
	password TEXT NOT NULL,
	-- unencrypted
	email TEXT NOT NULL UNIQUE
);

CREATE TABLE "priv_api_client" (
	client_id TEXT PRIMARY KEY NOT NULL,
	client_secret TEXT NOT NULL,
	name TEXT NOT NULL,
	author BIGINT REFERENCES account(id) NOT NULL,

	pm_customise_profile BOOLEAN,
	pm_customise_score BOOLEAN,
	pm_customise_session BOOLEAN,
	pm_delete_score BOOLEAN,
	pm_manage_rivals BOOLEAN,
	pm_manage_targets BOOLEAN,
	pm_submit_score BOOLEAN,
	pm_manage_challenges BOOLEAN,

	api_key_template TEXT CHECK (api_key_template ~ '%%TACHI_KEY%%'),
	api_key_filename TEXT,
	webhook_uri TEXT,
	redirect_uri TEXT,
	is_builtin BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "priv_api_token" (
	token TEXT PRIMARY KEY NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,
	identifier TEXT NOT NULL,
	
	pm_customise_profile BOOLEAN,
	pm_customise_score BOOLEAN,
	pm_customise_session BOOLEAN,
	pm_delete_score BOOLEAN,
	pm_manage_rivals BOOLEAN,
	pm_manage_targets BOOLEAN,
	pm_submit_score BOOLEAN,
	pm_manage_challenges BOOLEAN,

	from_oauth2_client TEXT REFERENCES priv_api_client(client_id) ON DELETE CASCADE
);

CREATE TABLE "priv_invite" (
	code TEXT PRIMARY KEY NOT NULL,
	created_by BIGINT REFERENCES account(id) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL,

	consumed BOOLEAN NOT NULL,
	consumed_by BIGINT REFERENCES account(id),
	consumed_at TIMESTAMPTZ
);

CREATE TABLE "priv_verify_email_token" (
	token TEXT PRIMARY KEY NOT NULL,
	email TEXT NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL
);

CREATE TABLE "priv_password_reset_token" (
	token TEXT PRIMARY KEY NOT NULL,
	created_on TIMESTAMPTZ NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL
);

CREATE TABLE "priv_oauth2_auth_token" (
	token TEXT PRIMARY KEY NOT NULL,
	created_on TIMESTAMPTZ NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL
);

CREATE TABLE "priv_svc_myt_card_info" (
	-- TODO(zk) what's the primacy here?
	-- One card access code => one user, definitely
	-- but should you be able to guess that card IDs are in use
	-- by submitting cards to this endpoint?
	--
	-- n.g.
	card_access_code TEXT PRIMARY KEY,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	-- One MYT card integration row per account (upsert target for UPDATE_MYT_CARD_INFO).
	CONSTRAINT priv_svc_myt_card_info_user_id_key UNIQUE (user_id)
);

CREATE TABLE "priv_svc_cg_card_info" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	-- TODO(zk) these should be uppercased to be consistent with
	-- kai
	service TEXT NOT NULL CHECK (service IN ('dev', 'gan', 'nag')),

	PRIMARY KEY (user_id, service),

	card_id TEXT NOT NULL,
	pin TEXT NOT NULL CHECK (pin ~ '^[0-9]{4}$')
);

CREATE TABLE "priv_svc_kai_auth_token" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	service TEXT NOT NULL CHECK (service IN ('FLO', 'EAG', 'MIN')),
	PRIMARY KEY (user_id, service),

	token TEXT NOT NULL,
	refresh_token TEXT NOT NULL
);

CREATE TABLE "svc_fer_settings" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	force_static_import BOOLEAN NOT NULL
);

CREATE TABLE "priv_svc_fer_card" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	card_id TEXT NOT NULL,

	PRIMARY KEY (user_id, card_id)
);

CREATE TABLE "svc_kshook_sv6c_settings" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	force_static_import BOOLEAN NOT NULL
);

CREATE TABLE "import_lock" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	locked BOOLEAN NOT NULL,
	locked_at TIMESTAMPTZ
);

CREATE TABLE "invite_lock" (
	user_id BIGINT REFERENCES account(id) PRIMARY KEY NOT NULL,
	locked BOOLEAN NOT NULL,
	locked_at TIMESTAMPTZ
);

CREATE TABLE "notification" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
	title TEXT NOT NULL,
	sent_to BIGINT REFERENCES account(id) NOT NULL,
	sent_at TIMESTAMPTZ NOT NULL,
	read BOOLEAN NOT NULL,

	-- complex payload stuff: done at typescript time.
	kind TEXT NOT NULL CHECK (kind IN ('rivaled_by', 'quest_changed', 'site_announcement')),
	payload JSONB NOT NULL
);

CREATE TABLE "bms_course_lookup" (
	-- TODO(zk): This makes the false assertion that only one
	-- course may exist with a given set of md5s -- i.e. no one
	-- else will make another course with the same charts in the
	-- same order. This is not correct, and might bite us in the
	-- future.
	--
	-- This data is sourced from seeds at the moment.
	md5sums TEXT PRIMARY KEY NOT NULL CHECK (
		md5sums ~ '^[0-9a-f]+$' AND char_length(md5sums) % 32 = 0
	),
	title TEXT NOT NULL UNIQUE,
	set TEXT NOT NULL,
	game GAME NOT NULL,
	value TEXT NOT NULL
);

CREATE TABLE "folder" (
	id TEXT PRIMARY KEY NOT NULL,
	legacy_id TEXT UNIQUE NOT NULL,
	game GAME NOT NULL,
	inactive BOOLEAN NOT NULL,
	title TEXT NOT NULL,

	-- Used in URLs. should be short, but must be unique per game!
	slug TEXT NOT NULL,

	-- SQL predicate (no leading WHERE) for charts in this folder; matches seeds `where`.
	-- Quoted: "where" is a reserved word in SQL.
	"where" TEXT NOT NULL,

	-- NULL means no version restriction.
	version_filter TEXT[],
	search_terms TEXT[] NOT NULL
);
CREATE UNIQUE INDEX folder_unique_slug_game ON "folder" (game, slug);

CREATE TABLE "table" ( -- heh
	id TEXT PRIMARY KEY NOT NULL,
	legacy_id TEXT UNIQUE NOT NULL,
	game GAME NOT NULL,
	inactive BOOLEAN NOT NULL,
	title TEXT NOT NULL,
	default_value BOOLEAN NOT NULL,

	-- Used in URLs. should be short, but must be unique per game!
	slug TEXT
);
CREATE UNIQUE INDEX table_unique_slug_game ON "table" (game, slug) WHERE slug IS NOT NULL;

-- Partial unique index: at most one default table per game.
CREATE UNIQUE INDEX one_default_table_per_game ON "table" (game) WHERE default_value = true;

CREATE TABLE "table_folder" (
	table_id TEXT REFERENCES "table"(id) NOT NULL,
	folder_id TEXT REFERENCES folder(id) NOT NULL,
	-- Order within the table; matches the `folders` array index in `tables.json`.
	ordering INTEGER NOT NULL,

	PRIMARY KEY (table_id, folder_id)
);

-- notable difference from Tachi2; all songs and charts are in
-- one table and not split across N tables
-- no real reason for this ever to have _not_ been the case
-- as it just moves "query" logic to typescript level logic
-- for no benefit.
CREATE TABLE "song" (
	id TEXT PRIMARY KEY NOT NULL,
	legacy_id INT NOT NULL,
	game_group GAME_GROUP NOT NULL,

	UNIQUE (game_group, legacy_id),

	title TEXT NOT NULL,
	artist TEXT NOT NULL,

	search_terms TEXT[] NOT NULL,
	alt_titles TEXT[] NOT NULL,

	-- Denormalized search_term + alt_title text for FTS (kept in sync with seeds / triggers).
	fts_document TEXT NOT NULL DEFAULT '',
	textsearch tsvector NOT NULL GENERATED ALWAYS AS (
		setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
			setweight(to_tsvector('simple', coalesce(artist, '')), 'B') ||
			setweight(to_tsvector('simple', coalesce(fts_document, '')), 'C')
	) STORED,
	data JSONB NOT NULL -- game specific payload
);

-- Populate fts_document from search_terms / alt_titles (no-op on empty DB; seeds also set this column).
UPDATE song AS s
SET fts_document = trim(
	both ' ' FROM concat_ws(
		' ',
		coalesce(array_to_string(s.search_terms, ' '), ''),
		coalesce(array_to_string(s.alt_titles, ' '), '')
	)
);

CREATE INDEX song_textsearch_gin ON song USING GIN (textsearch);

CREATE INDEX song_title_trgm ON song USING GIN (title gin_trgm_ops);

CREATE INDEX song_artist_trgm ON song USING GIN (artist gin_trgm_ops);

CREATE INDEX song_fts_document_trgm ON song USING GIN (fts_document gin_trgm_ops);

CREATE TABLE "chart" (
	id TEXT PRIMARY KEY NOT NULL,
	legacy_id TEXT UNIQUE NOT NULL,
	game GAME NOT NULL,
	song_id TEXT REFERENCES song(id) NOT NULL,

	level TEXT NOT NULL,
	level_num FLOAT8 NOT NULL,

	is_primary BOOLEAN NOT NULL,
	difficulty TEXT NOT NULL,

	versions TEXT[] NOT NULL,

	data JSONB NOT NULL, -- game specific payload

	-- SHA-256 hex digest of chart fields that feed scoreDeriver/scoreCalcs. When this
	-- changes, scores on the chart need re-derivation.
	derivation_checksum TEXT
);

-- Denormalized chart → folders cache (rebuilt by app; see rebuildFolderChartLookup).
CREATE TABLE "folder_chart_lookup" (
	folder_id TEXT NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
	chart_id TEXT NOT NULL REFERENCES chart(id) ON DELETE CASCADE,

	PRIMARY KEY (folder_id, chart_id)
);
CREATE INDEX ON "folder_chart_lookup" (folder_id);
CREATE INDEX ON "folder_chart_lookup" (chart_id);

CREATE TABLE "game_rival" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	game GAME NOT NULL,
	rival BIGINT REFERENCES account(id) NOT NULL,

	PRIMARY KEY (user_id, game, rival),

	CHECK (user_id != rival)
);

-- Per-user per-game: ratings/classes (import-derived) + UGPT preferences + showcase JSON (Tachi3 #47).
CREATE TABLE "game_profile" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	game GAME NOT NULL,

	PRIMARY KEY (user_id, game),

	ratings JSONB NOT NULL,
	classes JSONB NOT NULL,

	pf_preferred_score_alg TEXT,
	pf_preferred_session_alg TEXT,
	pf_preferred_profile_alg TEXT,
	pf_preferred_default_enum TEXT,
	pf_default_table TEXT,
	pf_preferred_ranking TEXT,

	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	showcase JSONB NOT NULL DEFAULT '[]'::jsonb,

	CONSTRAINT game_profile_pf_preferred_ranking_check
		CHECK (pf_preferred_ranking IS NULL OR pf_preferred_ranking IN ('global', 'rival'))
);

CREATE TABLE "game_stats_snapshot" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	game GAME NOT NULL,
	timestamp TIMESTAMPTZ NOT NULL,

	PRIMARY KEY (user_id, game, timestamp),

	playcount BIGINT NOT NULL,

	-- Record<string, number>
	ratings JSONB NOT NULL,
	-- Record<string, string>
	classes JSONB NOT NULL,
	-- Record<string, {outOf: integer, ranking: integer}>
	rankings JSONB NOT NULL
);

CREATE TABLE "class_achievement" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),

	game GAME NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	class_set TEXT NOT NULL,
	class_prev_value TEXT NOT NULL,
	class_value TEXT NOT NULL,

	timestamp TIMESTAMPTZ NOT NULL
);

CREATE TABLE "session" (
	id TEXT PRIMARY KEY NOT NULL,

	user_id BIGINT REFERENCES account(id) NOT NULL,
	game GAME NOT NULL,

	name TEXT NOT NULL,
	description TEXT,

	time_inserted TIMESTAMPTZ NOT NULL,
	time_started TIMESTAMPTZ NOT NULL,
	time_ended TIMESTAMPTZ NOT NULL,

	calculated_data JSONB NOT NULL,
	highlight BOOLEAN NOT NULL,

	-- Session UGPT search: FTS + trgm (see lib/search/session-search.ts).
	textsearch tsvector NOT NULL GENERATED ALWAYS AS (
		setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
			setweight(to_tsvector('simple', coalesce(description, '')), 'B')
	) STORED
);

CREATE TABLE "import" (
	id TEXT PRIMARY KEY NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	time_started TIMESTAMPTZ NOT NULL,
	time_finished TIMESTAMPTZ NOT NULL,
	game_group GAME_GROUP NOT NULL,

	import_type IMPORT_TYPE NOT NULL,
	user_intent BOOLEAN NOT NULL,

	service TEXT NOT NULL
);

-- Some import methods import for multiple games
-- but importantly they're always in the same game group
-- this is a random tachi2 holdover.
CREATE TABLE "import_game" (
	id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	game GAME NOT NULL,

	PRIMARY KEY (id, game)
);

CREATE TABLE "import_error" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),

	import_id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	type TEXT NOT NULL,
	message TEXT NOT NULL
);

CREATE TABLE "import_session" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),

	import_id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	session_id TEXT REFERENCES session(id) NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('appended', 'created')),

	UNIQUE (import_id, session_id)
);

CREATE TABLE "import_class" (
	row_id UUID PRIMARY KEY DEFAULT uuidv7(),

	import_id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	game GAME NOT NULL,
	set TEXT NOT NULL,
	prev TEXT,
	new TEXT NOT NULL
);


CREATE TABLE "import_timing" (
	id TEXT PRIMARY KEY REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	timestamp TIMESTAMPTZ NOT NULL,

	import_secs_avg FLOAT8 NOT NULL,
	import_parse_secs_avg FLOAT8 NOT NULL,
	pb_secs_avg FLOAT8 NOT NULL,
	session_secs_avg FLOAT8 NOT NULL,

	parse_secs FLOAT8 NOT NULL,
	import_secs FLOAT8 NOT NULL,
	import_parse_secs FLOAT8 NOT NULL,
	session_secs FLOAT8 NOT NULL,
	pb_secs FLOAT8 NOT NULL,
	ugs_secs FLOAT8 NOT NULL,
	goal_secs FLOAT8 NOT NULL,
	quest_secs FLOAT8 NOT NULL,
	
	-- not actually a sum of the above fields; just import.end - import.start
	total_secs FLOAT8 NOT NULL
);

CREATE TABLE "score" (
	id TEXT PRIMARY KEY NOT NULL,

	user_id BIGINT REFERENCES account(id) NOT NULL,
	chart_id TEXT REFERENCES chart(id) NOT NULL,

	game GAME NOT NULL,

	-- TODO(zk): FK references are disabled here
	-- because some scores point to sessions that
	-- never happened!
	--
	-- Also this is allowed to be null, because
	-- some older scores don't belong to sessions
	-- or imports. It's not good. A future migration
	-- will unfuck this.
	session_id TEXT,
	import_id TEXT,

	-- what would be { ...providedMetrics, ...optionalMetrics } in Mongo
	data JSONB NOT NULL,
	-- f(chart, score.data) => score.derived_data
	derived_data JSONB NOT NULL,
	-- f(chart, score.data) => score.calculated_data
	calculated_data JSONB NOT NULL,
	-- What was "judgements" in Mongo
	judgements JSONB NOT NULL,

	meta JSONB NOT NULL,
	
	time_achieved TIMESTAMPTZ,
	time_added TIMESTAMPTZ NOT NULL,
	
	highlight BOOLEAN NOT NULL,
	comment TEXT,

	-- Staging: false until post-import steps finish; then true (see score_import_uncommitted_idx).
	committed BOOLEAN NOT NULL DEFAULT TRUE
);

-- Mark here when PBs become dirty and need to be recalculated.
CREATE TABLE pb_dirty (
	user_id BIGINT NOT NULL,
	chart_id TEXT NOT NULL,
	enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, chart_id)
);

-- Mark here when scores become dirty and need to be recalculated.
CREATE TABLE "score_rederive" (
	chart_id TEXT NOT NULL PRIMARY KEY,
	enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session aggregate `calculated_data` must be refreshed when committed scores in that session change.
CREATE TABLE session_dirty (
	session_id TEXT NOT NULL PRIMARY KEY,
	enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-playtype game stats (`game_profile`) must be refreshed when committed scores change (ratings use PBs).
CREATE TABLE game_profile_dirty (
	user_id BIGINT NOT NULL,
	game GAME NOT NULL,
	enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, game)
);

-- Trigger function: on any score INSERT/UPDATE/DELETE, mark the (user_id, chart_id)
-- pair as needing PB recalculation.
CREATE FUNCTION enqueue_pb_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		INSERT INTO pb_dirty (user_id, chart_id)
		VALUES (OLD.user_id, OLD.chart_id)
		ON CONFLICT DO NOTHING;
	ELSE
		INSERT INTO pb_dirty (user_id, chart_id)
		VALUES (NEW.user_id, NEW.chart_id)
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_pb_dirty"
	AFTER INSERT OR UPDATE OR DELETE ON score
	FOR EACH ROW EXECUTE FUNCTION enqueue_pb_dirty();

-- Staging scores (committed = false) skip these queues until commit.
CREATE FUNCTION enqueue_session_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.committed AND OLD.session_id IS NOT NULL THEN
			INSERT INTO session_dirty (session_id)
			VALUES (OLD.session_id)
			ON CONFLICT DO NOTHING;
		END IF;
	ELSIF TG_OP = 'UPDATE' THEN
		IF NEW.committed THEN
			IF OLD.session_id IS NOT NULL AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
				INSERT INTO session_dirty (session_id)
				VALUES (OLD.session_id)
				ON CONFLICT DO NOTHING;
			END IF;
			IF NEW.session_id IS NOT NULL THEN
				INSERT INTO session_dirty (session_id)
				VALUES (NEW.session_id)
				ON CONFLICT DO NOTHING;
			END IF;
		END IF;
	ELSE
		IF NEW.committed AND NEW.session_id IS NOT NULL THEN
			INSERT INTO session_dirty (session_id)
			VALUES (NEW.session_id)
			ON CONFLICT DO NOTHING;
		END IF;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_session_dirty"
	AFTER INSERT OR UPDATE OR DELETE ON score
	FOR EACH ROW EXECUTE FUNCTION enqueue_session_dirty();

CREATE FUNCTION enqueue_game_profile_dirty() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.committed THEN
			INSERT INTO game_profile_dirty (user_id, game)
			VALUES (OLD.user_id, OLD.game)
			ON CONFLICT DO NOTHING;
		END IF;
	ELSIF TG_OP = 'UPDATE' THEN
		IF NEW.committed THEN
			INSERT INTO game_profile_dirty (user_id, game)
			VALUES (NEW.user_id, NEW.game)
			ON CONFLICT DO NOTHING;
		END IF;
	ELSE
		IF NEW.committed THEN
			INSERT INTO game_profile_dirty (user_id, game)
			VALUES (NEW.user_id, NEW.game)
			ON CONFLICT DO NOTHING;
		END IF;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_game_profile_dirty"
	AFTER INSERT OR UPDATE OR DELETE ON score
	FOR EACH ROW EXECUTE FUNCTION enqueue_game_profile_dirty();

-- Trigger function: on chart UPDATE, if derivation_checksum changed, enqueue the chart
-- for score re-derivation.
CREATE FUNCTION enqueue_score_rederive() RETURNS trigger AS $$
BEGIN
	IF OLD.derivation_checksum IS DISTINCT FROM NEW.derivation_checksum THEN
		INSERT INTO score_rederive (chart_id)
		VALUES (NEW.id)
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "chart_score_rederive"
	AFTER UPDATE ON chart
	FOR EACH ROW EXECUTE FUNCTION enqueue_score_rederive();

CREATE TABLE "pb" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),

	user_id BIGINT NOT NULL REFERENCES account(id),
	chart_id TEXT NOT NULL REFERENCES chart(id),

	-- for "Profile views", where the PB is
	-- calculated from a subset of the user's
	-- scores.
	lens TEXT,

	UNIQUE (user_id, chart_id, lens),

	-- all data is f(scores) => pb
	data JSONB NOT NULL,
	derived_data JSONB NOT NULL,
	calculated_data JSONB NOT NULL,
	judgements JSONB NOT NULL,

	-- how to rank scores. Five (sorry, hardcoded) additional
	-- tiebreakers are available.
	ranking_value FLOAT8 NOT NULL,
	ranking_value_tb1 FLOAT8,
	ranking_value_tb2 FLOAT8,
	ranking_value_tb3 FLOAT8,
	ranking_value_tb4 FLOAT8,
	ranking_value_tb5 FLOAT8,

	-- needless bullshit manually copied from scores
	-- it would be nice to figure this out with a join instead
	-- but too complex.
	highlight BOOLEAN NOT NULL,
	-- MAX(score.time_achieved)
	time_achieved TIMESTAMPTZ
);

CREATE TABLE "pb_composed_from" (
	pb_id UUID REFERENCES pb(row_id) NOT NULL,
	score_id TEXT REFERENCES score(id) NOT NULL,
	merge_name TEXT NOT NULL,

	PRIMARY KEY (pb_id, score_id)
);

-- Global chart rank/outOf live in one place: the leaderboard window over `pb`,
-- not duplicated into `calculated_data`.
CREATE VIEW "chart_leaderboard" AS
SELECT
	pb.*,
	RANK() OVER (
		PARTITION BY chart_id, lens
		ORDER BY
			ranking_value DESC NULLS LAST,
			ranking_value_tb1 DESC NULLS LAST,
			ranking_value_tb2 DESC NULLS LAST,
			ranking_value_tb3 DESC NULLS LAST,
			ranking_value_tb4 DESC NULLS LAST,
			ranking_value_tb5 DESC NULLS LAST,
			time_achieved ASC NULLS LAST
	) AS rank,
	COUNT(*) OVER (PARTITION BY chart_id, lens) AS out_of
FROM pb;


CREATE TABLE "orphan_score" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
	user_id BIGINT REFERENCES account(id) NOT NULL,
	import_id TEXT REFERENCES import(id) ON DELETE SET NULL,

	orphan_id TEXT NOT NULL,
	import_type IMPORT_TYPE NOT NULL,
	game_group GAME_GROUP NOT NULL,

	data JSONB NOT NULL,
	context JSONB NOT NULL,
	time_inserted TIMESTAMPTZ NOT NULL,

	error_message TEXT NOT NULL
);

CREATE TABLE "score_blacklist" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
	user_id BIGINT REFERENCES account(id) NOT NULL,
	score_id TEXT NOT NULL,

	UNIQUE (user_id, score_id)
);

CREATE TABLE "folder_view" (
	user_id BIGINT REFERENCES account(id) NOT NULL,
	folder_id TEXT REFERENCES folder(id) ON UPDATE CASCADE NOT NULL,

	PRIMARY KEY (user_id, folder_id),

	last_viewed TIMESTAMPTZ NOT NULL
);


-- orphan-chart-queue. Used for BMS to de-orphan charts.
CREATE TABLE "orphan_chart" (
	id TEXT PRIMARY KEY NOT NULL,
	game GAME NOT NULL,

	-- full ChartDocument + SongDocument blobs, validated on re-import
	chart_doc JSONB NOT NULL,
	song_doc JSONB NOT NULL
);

CREATE TABLE "orphan_chart_user" (
	orphan_chart_id TEXT REFERENCES orphan_chart(id) NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	PRIMARY KEY (orphan_chart_id, user_id)
);

-- import-trackers (ephemeral; removed on success, kept on failure)
CREATE TABLE "import_tracker" (
	import_id TEXT PRIMARY KEY NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,
	import_type IMPORT_TYPE NOT NULL,
	user_intent BOOLEAN NOT NULL,
	time_started TIMESTAMPTZ NOT NULL,

	-- NULL = ONGOING, non-NULL = FAILED
	error JSONB
);


-- goals

-- TODO(zk): A lot of this shit can just be completely ripped out
-- it's a terrible design decision and data duplication abound
-- everywhere.
--
-- Maybe just rewrite goals/quests!!

CREATE TABLE "goal" (
	id TEXT PRIMARY KEY NOT NULL,
	game GAME NOT NULL,
	name TEXT NOT NULL,

	-- "single" | "multi" | "folder" + associated chart data
	charts JSONB NOT NULL,
	-- criteria: {mode, key, value, ...}
	criteria JSONB NOT NULL
);

CREATE TABLE "goal_sub" (
	goal_id TEXT REFERENCES goal(id) NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	PRIMARY KEY (goal_id, user_id),

	last_interaction TIMESTAMPTZ,
	progress FLOAT8,
	progress_human TEXT NOT NULL,
	out_of FLOAT8 NOT NULL,
	out_of_human TEXT NOT NULL,

	achieved BOOLEAN NOT NULL,
	time_achieved TIMESTAMPTZ,
	was_instantly_achieved BOOLEAN NOT NULL,
	was_assigned_standalone BOOLEAN NOT NULL
);

-- quests
CREATE TABLE "quest" (
	id TEXT PRIMARY KEY NOT NULL,
	game GAME NOT NULL,
	name TEXT NOT NULL,
	description TEXT NOT NULL,

	-- Array<QuestSection> - sections with titles, descs, and goal references.
	-- Too structured/variable to flatten usefully.
	quest_data JSONB NOT NULL
);

CREATE TABLE "quest_sub" (
	quest_id TEXT REFERENCES quest(id) NOT NULL,
	user_id BIGINT REFERENCES account(id) NOT NULL,

	PRIMARY KEY (quest_id, user_id),

	progress INT NOT NULL,
	last_interaction TIMESTAMPTZ,
	achieved BOOLEAN NOT NULL,
	time_achieved TIMESTAMPTZ,
	was_instantly_achieved BOOLEAN NOT NULL
);

-- questlines
CREATE TABLE "questline" (
	id TEXT PRIMARY KEY NOT NULL,
	game GAME NOT NULL,
	name TEXT NOT NULL,
	description TEXT NOT NULL
);

CREATE TABLE "questline_quest" (
	questline_id TEXT REFERENCES questline(id) NOT NULL,
	quest_id TEXT REFERENCES quest(id) NOT NULL,
	sort_order INT NOT NULL,

	PRIMARY KEY (questline_id, quest_id)
);

-- TODO(zk): This should really be like, "goal_activity" in my
-- opinion.

CREATE TABLE "import_quest" (
	row_id UUID PRIMARY KEY DEFAULT uuidv7(),

	import_id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	quest_id TEXT REFERENCES quest(id) NOT NULL,

	prev_achieved BOOLEAN NOT NULL,
	prev_progress INTEGER NOT NULL,

	new_achieved BOOLEAN NOT NULL,
	new_progress INTEGER NOT NULL
);

CREATE TABLE "import_goal" (
	row_id UUID PRIMARY KEY DEFAULT uuidv7(),

	import_id TEXT REFERENCES import(id) ON DELETE CASCADE NOT NULL,
	goal_id TEXT REFERENCES goal(id) NOT NULL,

	prev_achieved BOOLEAN NOT NULL,
	prev_out_of INTEGER NOT NULL,
	prev_out_of_human TEXT NOT NULL,
	prev_progress INTEGER,
	prev_progress_human TEXT NOT NULL,

	new_achieved BOOLEAN NOT NULL,
	new_out_of INTEGER NOT NULL,
	new_out_of_human TEXT NOT NULL,
	new_progress INTEGER,
	new_progress_human TEXT NOT NULL
);

-- ==> Indexes

-- score (15M rows)
-- PB construction: "all scores for user X on chart Y", score dedup on import.
-- The hottest path in the whole import pipeline.
CREATE INDEX score_user_chart_idx ON score (user_id, chart_id);

-- Recent scores feed and "most recent play" endpoints. user_id first so
-- the planner can filter to one user before sorting.
CREATE INDEX score_user_recent_idx ON score (user_id, time_added DESC);

-- Highlights feed and activity. Partial: only the rows that matter.
CREATE INDEX score_user_highlights_idx ON score (user_id, time_added DESC)
	WHERE highlight = true;

-- "All scores on chart X" - chart pages, playcount, import duplicate check.
-- Needed separately because score_user_chart_idx has user_id as the left column.
CREATE INDEX score_chart_idx ON score (chart_id);

-- Failed-import cleanup: delete uncommitted rows by import_id.
CREATE INDEX score_import_uncommitted_idx ON score (import_id)
	WHERE
		committed = FALSE;

CREATE UNIQUE INDEX orphan_score_orphan_id_key ON orphan_score (orphan_id);

-- pb (5M rows) - hottest table
-- The single most important index in the schema.
-- Serves: chart_leaderboard view, leaderboard pagination, and the COUNT rank
-- queries ("how many PBs beat mine?"). chart_id partitions the 5M rows into
-- per-chart buckets; ranking columns give the sort order for free.
CREATE INDEX pb_leaderboard_idx ON pb (
	chart_id,
	ranking_value      DESC NULLS LAST,
	ranking_value_tb1  DESC NULLS LAST,
	ranking_value_tb2  DESC NULLS LAST,
	ranking_value_tb3  DESC NULLS LAST,
	ranking_value_tb4  DESC NULLS LAST,
	ranking_value_tb5  DESC NULLS LAST,
	time_achieved      ASC  NULLS LAST
);

-- Reverse lookup: "which PB does this score contribute to?"
-- Used when deleting a score to find its PB for recomputation.
-- The PK (pb_id, score_id) can't serve score_id-first lookups.
CREATE INDEX pb_composed_from_score_idx ON pb_composed_from (score_id);

-- session
-- UGPT session history ("show me user X's IIDX sessions, newest first").
-- game encodes both game+playtype in the new schema.
CREATE INDEX session_user_game_idx ON session (user_id, game, time_started DESC);

-- Global game activity feed ("recent sessions for IIDX globally").
CREATE INDEX session_game_recent_idx ON session (game, time_started DESC);

CREATE INDEX session_textsearch_gin ON session USING GIN (textsearch);

CREATE INDEX session_name_trgm ON session USING GIN (name gin_trgm_ops);

CREATE INDEX session_description_trgm ON session USING GIN (description gin_trgm_ops);

-- import
-- User's import history page. time_started DESC for newest-first ordering.
CREATE INDEX import_user_idx ON import (user_id, time_started DESC);

-- import_timing
-- Ported from Mongo. Admin/analytics queries filtering by timestamp range.
CREATE INDEX import_timing_timestamp_idx ON import_timing (timestamp);

-- notification
-- Notification inbox: "show sent_to=X's notifications, newest first".
-- Also serves unread-count query (WHERE read = false) via partial scan.
CREATE INDEX notification_inbox_idx ON notification (sent_to, read, sent_at DESC);

-- class_achievement
-- User's class history per game. Ported from Mongo's game+playtype+timeAchieved.
CREATE INDEX class_achievement_user_idx ON class_achievement (user_id, game, timestamp DESC);

-- Global recent class achievements (site-wide activity feed).
CREATE INDEX class_achievement_recent_idx ON class_achievement (game, timestamp DESC);

-- goal_sub / quest_sub
-- "All goals for user X". The PK is (goal_id, user_id) so user_id alone
-- has no usable left-prefix index. achieved included for cheap pending-goal scans.
CREATE INDEX goal_sub_user_idx ON goal_sub (user_id, achieved);

-- Same reason as above for quests.
CREATE INDEX quest_sub_user_idx ON quest_sub (user_id, achieved);

-- folder_view
-- "Recently viewed folders for user X", newest first. Drives the sidebar.
CREATE INDEX folder_view_user_idx ON folder_view (user_id, last_viewed DESC);

-- game_stats_snapshot
-- Historical snapshot queries by game+time (e.g. "rating history for all
-- IIDX players at a given timestamp"). PK is (user_id, game, timestamp),
-- so game-first lookups need their own index.
CREATE INDEX game_stats_snapshot_game_idx ON game_stats_snapshot (game, timestamp DESC);

-- chart - general
-- "All charts for song X" - song pages, chart listing. Postgres does NOT
-- auto-index FK columns, so this needs to be explicit.
CREATE INDEX chart_song_idx ON chart (song_id);

-- Folder membership (`BuildFolderQuery`): seeds often use `chart.level` / `chart.level_num`
-- without `chart.game`. Folder rows are per-game, so the app ANDs `chart.game = folder.game`;
-- these indexes avoid scanning all games' charts (~260k rows).
CREATE INDEX chart_game_level_idx ON chart (game, level);
CREATE INDEX chart_game_level_num_idx ON chart (game, level_num);

-- Primary chart lookup by (song, difficulty): score import and routing.
-- Partial: only index primary charts since those are what's looked up 99% of the time.
CREATE UNIQUE INDEX chart_primary_song_difficulty_idx
	ON chart (game, song_id, difficulty)
	WHERE is_primary = true;

-- chart - game-specific JSONB expression indexes
-- Partial expression indexes mirroring the per-game Mongo collections.
-- Used during score import to look up charts by their game-native ID or hash.

-- BMS: imported by MD5 and SHA256 hash. Both playtypes share an ID space.
CREATE UNIQUE INDEX chart_bms_7k_md5_idx   ON chart ((data->>'hashMD5'))   WHERE game = 'bms-7k';
CREATE UNIQUE INDEX chart_bms_14k_md5_idx  ON chart ((data->>'hashMD5'))   WHERE game = 'bms-14k';
CREATE UNIQUE INDEX chart_bms_7k_sha_idx   ON chart ((data->>'hashSHA256')) WHERE game = 'bms-7k';
CREATE UNIQUE INDEX chart_bms_14k_sha_idx  ON chart ((data->>'hashSHA256')) WHERE game = 'bms-14k';

-- PMS: same as BMS, two controller modes share ID space.
CREATE UNIQUE INDEX chart_pms_ctrl_md5_idx ON chart ((data->>'hashMD5'))    WHERE game = 'pms-controller';
CREATE UNIQUE INDEX chart_pms_kb_md5_idx   ON chart ((data->>'hashMD5'))    WHERE game = 'pms-keyboard';
CREATE UNIQUE INDEX chart_pms_ctrl_sha_idx ON chart ((data->>'hashSHA256')) WHERE game = 'pms-controller';
CREATE UNIQUE INDEX chart_pms_kb_sha_idx   ON chart ((data->>'hashSHA256')) WHERE game = 'pms-keyboard';

-- USC: SHA1 hash, two controller modes.
CREATE UNIQUE INDEX chart_usc_ctrl_sha1_idx ON chart ((data->>'hashSHA1')) WHERE game = 'usc-controller';
CREATE UNIQUE INDEX chart_usc_kb_sha1_idx   ON chart ((data->>'hashSHA1')) WHERE game = 'usc-keyboard';

-- IIDX: SHA256 non-unique (same chart can have multiple hashes across versions).
CREATE INDEX chart_iidx_sp_sha_idx ON chart ((data->>'hashSHA256')) WHERE game = 'iidx-sp';
CREATE INDEX chart_iidx_dp_sha_idx ON chart ((data->>'hashSHA256')) WHERE game = 'iidx-dp';

-- popn: SHA256 unique.
CREATE UNIQUE INDEX chart_popn_sha_idx ON chart ((data->>'hashSHA256')) WHERE game = 'popn';

-- IIDX: inGameID lookups. SP and DP have separate game values so indexed separately.
CREATE INDEX chart_iidx_sp_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'iidx-sp';
CREATE INDEX chart_iidx_dp_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'iidx-dp';

-- The following are all unique: one chart per (inGameID, difficulty) per game.
CREATE UNIQUE INDEX chart_sdvx_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'sdvx';
CREATE UNIQUE INDEX chart_museca_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'museca';
CREATE UNIQUE INDEX chart_chunithm_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'chunithm';
CREATE UNIQUE INDEX chart_gitadora_gita_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'gitadora-gita';
CREATE UNIQUE INDEX chart_gitadora_dora_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'gitadora-dora';
CREATE UNIQUE INDEX chart_wacca_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'wacca';
CREATE UNIQUE INDEX chart_jubeat_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'jubeat';
CREATE UNIQUE INDEX chart_maimai_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'maimai';
CREATE UNIQUE INDEX chart_maimaidx_ingameid_idx
	ON chart ((data->>'inGameID'), difficulty) WHERE game = 'maimaidx';

-- maimai/maimaidx also looked up by string ID.
CREATE UNIQUE INDEX chart_maimai_ingamestr_idx
	ON chart ((data->>'inGameStrID'), difficulty) WHERE game = 'maimai';
CREATE UNIQUE INDEX chart_maimaidx_ingamestr_idx
	ON chart ((data->>'inGameStrID'), difficulty) WHERE game = 'maimaidx';

-- <== End indexes

-- ==> Bot: discord-user-map
-- Maps Discord user IDs to Tachi accounts for the Discord bot integration.
-- Stored in private namespace because it contains API tokens.
CREATE TABLE "priv_discord_user_map" (
	user_id    BIGINT REFERENCES account(id) ON DELETE CASCADE NOT NULL,
	discord_id TEXT UNIQUE NOT NULL,
	api_token  TEXT REFERENCES priv_api_token(token) ON DELETE CASCADE NOT NULL
);

CREATE UNIQUE INDEX priv_discord_user_map_user_id_idx ON priv_discord_user_map (user_id);
-- <== End bot

-- Optional read-only role used by Grafana (may not exist in local/dev).
DO $grant$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
		EXECUTE 'GRANT USAGE ON SCHEMA public TO grafana_ro';
		EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro';
		EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_ro';
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro')
		AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tachi') THEN
		EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE tachi IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro';
		EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE tachi IN SCHEMA public GRANT SELECT ON SEQUENCES TO grafana_ro';
	END IF;
END
$grant$;