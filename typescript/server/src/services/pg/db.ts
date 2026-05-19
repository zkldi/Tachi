import type { Database } from "tachi-db";

import { Env } from "#lib/setup/config";
import { Kysely, PostgresDialect } from "kysely";
import pg, { Pool } from "pg";

// pg returns BIGINT/BIGSERIAL (OID 20) as strings by default to avoid
// precision loss for very large values. Our IDs are well within Number.MAX_SAFE_INTEGER,
// so parse them as numbers to keep types consistent across the codebase.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => val);
pg.types.setTypeParser(pg.types.builtins.INT4, (val) => Number(val));
pg.types.setTypeParser(pg.types.builtins.INT2, (val) => Number(val));
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => Number(val));

const pool = new Pool({ connectionString: Env.POSTGRES_URL, max: Env.PG_POOL_MAX });

if (process.env.NODE_ENV === "test") {
	// Swallow 57P01 (admin_shutdown) errors that arrive on idle pool connections
	// during test teardown. Prevents some flakiness in CI.
	pool.on("error", (err: { code?: string } & Error) => {
		if (err.code !== "57P01") {
			throw err;
		}
	});

	// Track whether app code under test has actually touched the DB since the
	// last reset. vitest.setup.ts reads this via `globalThis` (a property read,
	// no import) so files that never load #services/pg/db skip resetDatabase
	// entirely - the biggest single source of per-file overhead in pure-unit
	// tests where the first beforeEach was paying ~2 s just to import this
	// module and run a probe query.
	const g = globalThis as unknown as {
		__tachi_pg_loaded?: boolean;
		__tachi_pg_used?: boolean;
	};
	g.__tachi_pg_loaded = true;
	const origConnect = pool.connect.bind(pool);
	const origQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;

	pool.connect = ((...args: unknown[]) => {
		g.__tachi_pg_used = true;
		return (origConnect as (...a: unknown[]) => unknown)(...args);
	}) as typeof pool.connect;

	pool.query = ((...args: unknown[]) => {
		g.__tachi_pg_used = true;
		return origQuery(...args);
	}) as typeof pool.query;
}

const DB = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});

export async function ClosePgConnection() {
	await DB.destroy();
}

export default DB;
