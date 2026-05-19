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

	const queryTiming = process.env.TACHI_QUERY_TIMING === "1";

	pool.connect = ((...args: unknown[]) => {
		g.__tachi_pg_used = true;
		if (queryTiming) {
			const t0 = performance.now();
			const p = (origConnect as (...a: unknown[]) => Promise<pg.PoolClient>)(...args);
			return p.then((client) => {
				const origClientQuery = client.query.bind(client) as (...a: unknown[]) => unknown;
				client.query = ((...qa: unknown[]) => {
					const qt0 = performance.now();
					const sql =
						typeof qa[0] === "string"
							? qa[0]
							: ((qa[0] as { text?: string } | null)?.text ?? "<unknown>");
					const result = origClientQuery(...qa) as Promise<unknown>;
					return Promise.resolve(result).then((v) => {
						const dt = performance.now() - qt0;
						process.stderr.write(
							`[qtiming] ${dt.toFixed(1).padStart(7)}ms  +${(qt0 - t0).toFixed(1)}ms_after_connect  ${sql.slice(0, 80).replace(/\s+/gu, " ")}\n`,
						);
						return v;
					});
				}) as typeof client.query;
				return client;
			});
		}
		return (origConnect as (...a: unknown[]) => unknown)(...args);
	}) as typeof pool.connect;

	pool.query = ((...args: unknown[]) => {
		g.__tachi_pg_used = true;
		if (queryTiming) {
			const qt0 = performance.now();
			const sql =
				typeof args[0] === "string"
					? args[0]
					: ((args[0] as { text?: string } | null)?.text ?? "<unknown>");
			const result = origQuery(...args) as Promise<unknown>;
			return Promise.resolve(result).then((v) => {
				process.stderr.write(
					`[qtiming] ${(performance.now() - qt0).toFixed(1).padStart(7)}ms  pool.query  ${sql.slice(0, 80).replace(/\s+/gu, " ")}\n`,
				);
				return v;
			});
		}
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
