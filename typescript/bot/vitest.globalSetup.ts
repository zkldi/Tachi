import { execSync } from "node:child_process";
import pg from "pg";

const POSTGRES_HOST = process.env.POSTGRES_TEST_HOST ?? "tachi-postgres-test";
const POSTGRES_USER = "tachi";
const POSTGRES_PASS = "tachi";
const TEMPLATE_DB = "tachi_bot_test_template";

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
 * Global vitest setup - runs ONCE before any workers start.
 *
 * Creates a fully-migrated template database and installs per-test dirty-table
 * tracking on it. Workers clone from it instead of running migrations
 * themselves, which is much faster.
 */
export default async function globalSetup() {
	execSync("just bot-db-test-template-reset", { stdio: "inherit" });
	await installTestDirtyTracking();
}
