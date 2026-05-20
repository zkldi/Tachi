import { execSync } from "node:child_process";

import pg from "pg";

import { ensureTestCdnBucket } from "./src/test-utils/ensure-test-cdn-bucket";

// See note in vitest.setup.ts about POSTGRES_TEST_HOST + tachi-postgres-test.
const POSTGRES_HOST = process.env.POSTGRES_TEST_HOST ?? "tachi-postgres";
const POSTGRES_USER = "tachi";
const POSTGRES_PASS = "tachi";
const TEMPLATE_DB = "tachi_server_test_template";
const WORKER_DB_PREFIX = "tachi_server_test_";

/**
 * Installs per-test dirty-table tracking in the template DB so every worker
 * clone inherits it. Adds a `_test_dirty_tables` table plus statement-level
 * AFTER INSERT/UPDATE/DELETE triggers on every public base table that record
 * which tables were written to during a test. `beforeEach` in `vitest.setup.ts`
 * then TRUNCATEs only those tables instead of scanning the catalog and
 * truncating all of them.
 *
 * We deliberately do NOT install an AFTER TRUNCATE trigger: the reset itself
 * TRUNCATEs the dirty tables, and we don't want that statement to re-mark
 * them as dirty for the next test.
 */
async function installTestDirtyTracking(): Promise<void> {
	const client = new pg.Client({
		host: POSTGRES_HOST,
		user: POSTGRES_USER,
		password: POSTGRES_PASS,
		database: TEMPLATE_DB,
	});

	await client.connect();

	try {
		await client.query(`
			CREATE TABLE IF NOT EXISTS _test_dirty_tables (table_name text PRIMARY KEY);

			CREATE OR REPLACE FUNCTION _test_track_dirty() RETURNS trigger
				LANGUAGE plpgsql AS $fn$
				BEGIN
					INSERT INTO _test_dirty_tables(table_name) VALUES (TG_TABLE_NAME)
						ON CONFLICT DO NOTHING;
					RETURN NULL;
				END;
				$fn$;

			DO $do$
			DECLARE r record;
			BEGIN
				FOR r IN
					SELECT table_name FROM information_schema.tables
					WHERE table_schema = 'public'
						AND table_type = 'BASE TABLE'
						AND table_name <> '_test_dirty_tables'
				LOOP
					EXECUTE format('DROP TRIGGER IF EXISTS _test_dirty_trk ON %I', r.table_name);
					EXECUTE format(
						'CREATE TRIGGER _test_dirty_trk AFTER INSERT OR UPDATE OR DELETE ON %I '
						|| 'FOR EACH STATEMENT EXECUTE FUNCTION _test_track_dirty()',
						r.table_name
					);
				END LOOP;
			END
			$do$;
		`);
	} finally {
		// Must disconnect before workers try to CREATE DATABASE ... TEMPLATE this DB:
		// Postgres requires zero sessions on the source.
		await client.end();
	}
}

/**
 * Drops every leaked worker DB (`tachi_server_test_*` minus the template).
 *
 * With `isolate: false` (vitest.config.ts) the per-worker setup file does NOT
 * drop its DB on `afterAll` - that hook fires per test file and we share the
 * worker across many files. We sweep them here as part of the suite-wide
 * teardown, plus opportunistically at startup so stale DBs from a killed run
 * do not accumulate.
 */
async function dropLeakedWorkerDatabases(): Promise<void> {
	const client = new pg.Client({
		host: POSTGRES_HOST,
		user: POSTGRES_USER,
		password: POSTGRES_PASS,
		database: "postgres",
	});
	await client.connect();
	try {
		const res = await client.query<{ datname: string }>(
			`SELECT datname FROM pg_database WHERE datname LIKE $1 AND datname <> $2`,
			[`${WORKER_DB_PREFIX}%`, TEMPLATE_DB],
		);
		for (const { datname } of res.rows) {
			// Each step is best-effort: tachi-postgres-test runs with
			// `fsync=off + full_page_writes=off` for speed, so DROP DATABASE
			// storms occasionally trip `checkpoint request failed`. We sweep
			// again on the next run's globalSetup, so logging is enough.
			try {
				await client.query(
					`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
					[datname],
				);
				await client.query(`DROP DATABASE IF EXISTS "${datname}"`);
			} catch (err) {
				console.warn(`[vitest-globalSetup] failed to drop ${datname}:`, err);
			}
		}
	} finally {
		await client.end();
	}
}

/**
 * Global vitest setup - runs ONCE before any workers start.
 *
 * Creates a fully-migrated template database and installs per-test dirty-table
 * tracking on it. Workers clone from it instead of running migrations
 * themselves, which is much faster.
 *
 * Returns a teardown function (Vitest runs this when the entire suite exits)
 * that sweeps every leaked `tachi_server_test_*` worker DB.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
	const timing = process.env.TACHI_VITEST_TIMING === "1";
	const t0 = performance.now();
	execSync("just server-db-test-template-reset", { stdio: "inherit" });
	const t1 = performance.now();
	await installTestDirtyTracking();
	const t1b = performance.now();
	await ensureTestCdnBucket();
	const t1c = performance.now();
	// Sweep stale worker DBs from prior killed runs before workers start cloning.
	await dropLeakedWorkerDatabases();
	const t2 = performance.now();
	if (timing) {
		const resetMs = t1 - t0;
		const dirtyMs = t1b - t1;
		const cdnMs = t1c - t1b;
		const sweepMs = t2 - t1c;
		console.error(
			`[vitest-timing] globalSetup: template_reset_ms=${resetMs.toFixed(1)} install_dirty_tracking_ms=${dirtyMs.toFixed(1)} ensure_test_cdn_bucket_ms=${cdnMs.toFixed(1)} sweep_leaked_dbs_ms=${sweepMs.toFixed(1)} total_ms=${(t2 - t0).toFixed(1)}`,
		);
	}
	return async () => {
		const tTd0 = performance.now();
		await dropLeakedWorkerDatabases();
		if (timing) {
			console.error(
				`[vitest-timing] globalTeardown: sweep_leaked_dbs_ms=${(performance.now() - tTd0).toFixed(1)}`,
			);
		}
	};
}
