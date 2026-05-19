/**
 * Vitest per-worker setup for parallel test execution.
 *
 * Each WORKER (not file) gets its own isolated Postgres database cloned from
 * the template created in vitest.globalSetup.ts. With `pool: "threads"` and
 * `isolate: false`, this module evaluates ONCE per worker thread but the
 * lifecycle callbacks below still fire per test file - that asymmetry is
 * fundamental to the perf win of `isolate: false`. As a result:
 *
 *   - The per-worker DB is created lazily on the first file that needs it.
 *   - Cleanup (close pool, close mock-api, DROP DATABASE) deliberately does
 *     NOT happen in `afterAll` - that would kill shared resources mid-worker.
 *     Worker DBs are swept by vitest.globalSetup.ts's teardown.
 *   - `beforeEach` still runs per test; it TRUNCATEs whatever the previous
 *     test dirtied via the trigger-based tracker, gated on whether any app
 *     code in this worker has actually touched the DB.
 *
 * IMPORTANT: process.env assignments at the top level of this module run
 * before the test file's module graph is resolved, so app code that reads
 * env vars at import time (config.ts) sees the right values.
 */

import crypto from "node:crypto";

const WORKER_ID = crypto.randomUUID().slice(0, 8);
const WORKER_DB_NAME = `tachi_server_test_${WORKER_ID}`;

// `tachi-postgres-test` (tmpfs + fsync=off, see docker-compose-dev.yml) is the
// preferred backend for tests. Fall back to the dev Postgres if the dedicated
// service isn't running so a freshly-cloned repo still passes tests.
const POSTGRES_HOST = process.env.POSTGRES_TEST_HOST ?? "tachi-postgres";
const POSTGRES_USER = "tachi";
const POSTGRES_PASS = "tachi";

// Set POSTGRES_URL before any app code is imported - config.ts reads it at load time.
process.env.POSTGRES_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASS}@${POSTGRES_HOST}/${WORKER_DB_NAME}`;

// Now that env vars are set, we can safely import external packages.
import pg from "pg";
import { afterAll, beforeAll, beforeEach } from "vitest";

const TIMING = process.env.TACHI_VITEST_TIMING === "1";
const workerWallStart = performance.now();

let msCreateWorkerDb = 0;
let resetCalls = 0;
let msResetDatabaseTotal = 0;
let msResetDatabaseMax = 0;
let msRateLimitCacheTotal = 0;

const { Client } = pg;

function adminClient() {
	return new Client({
		host: POSTGRES_HOST,
		user: POSTGRES_USER,
		password: POSTGRES_PASS,
		database: "postgres",
	});
}

async function createWorkerDatabase() {
	const client = adminClient();

	await client.connect();

	try {
		const t0 = performance.now();
		await client.query(
			`CREATE DATABASE "${WORKER_DB_NAME}" TEMPLATE tachi_server_test_template`,
		);
		if (TIMING) {
			msCreateWorkerDb += performance.now() - t0;
		}
	} finally {
		await client.end();
	}
}

async function resetDatabase() {
	// Lazily import so env vars are definitely set before the pool is created.
	const { default: db } = await import("#services/pg/db");
	const { sql } = await import("kysely");

	// Dirty-table tracking is installed in the template by vitest.globalSetup.ts:
	// statement-level AFTER INSERT/UPDATE/DELETE triggers on every public base table
	// record their name in `_test_dirty_tables` whenever a test mutates them. We
	// TRUNCATE only those tables (plus the tracker itself), so read-only tests pay
	// for one tiny SELECT and write-heavy tests only pay for the rows they touched.
	const dirty = await sql<{ table_name: string }>`
		SELECT table_name FROM _test_dirty_tables
	`.execute(db);

	if (dirty.rows.length > 0) {
		const idents = ["_test_dirty_tables", ...dirty.rows.map((r) => r.table_name)].map((n) =>
			sql.id(n),
		);
		// TRUNCATE takes ACCESS EXCLUSIVE on every dirty table AND every table
		// reachable via FK CASCADE. With `pool: "threads"` + `isolate: false`
		// the mock-api supertest server is shared across files in a worker, so
		// an HTTP response from the previous `it()` can still be holding a row
		// lock on one of the cascade targets when `beforeEach` fires here. We
		// surface that as a fail-fast `lock_timeout` (set on the txn so it
		// applies to the TRUNCATE) instead of waiting `deadlock_timeout`
		// (1 s by default), then retry up to 5 times. CI exposes this maybe
		// 1-2 tests per ~1700 runs; locally it is invisible.
		await runTruncateWithRetry(async () => {
			await db.transaction().execute(async (trx) => {
				await sql`SET LOCAL lock_timeout = '500ms'`.execute(trx);
				await sql`TRUNCATE TABLE ${sql.join(
					idents,
					sql`, `,
				)} RESTART IDENTITY CASCADE`.execute(trx);
			});
		});
	}

	try {
		const { clearGameStatsCacheForTests } = await import("#server/router/api/v1/games/router");
		clearGameStatsCacheForTests();
	} catch {
		// ignore - router not loaded in edge test contexts
	}
}

const RETRYABLE_PG_CODES = new Set([
	"40P01", // deadlock_detected
	"55P03", // lock_not_available (lock_timeout)
]);

async function runTruncateWithRetry(fn: () => Promise<void>): Promise<void> {
	const maxAttempts = 5;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			// Sequential retry of a single fail-fast op; awaiting in the loop
			// is the whole point.
			// eslint-disable-next-line no-await-in-loop
			await fn();
			return;
		} catch (err) {
			const code = (err as { code?: string } | null)?.code;
			if (attempt === maxAttempts || code === undefined || !RETRYABLE_PG_CODES.has(code)) {
				throw err;
			}
			// Exponential backoff with jitter, capped: 20, 40, 80, 160 ms.
			const baseMs = 20 * 2 ** (attempt - 1);
			const sleepMs = baseMs + Math.floor(Math.random() * baseMs);
			// eslint-disable-next-line no-await-in-loop
			await new Promise((resolve) => setTimeout(resolve, sleepMs));
		}
	}
}

// Per-worker DB creation is lazy: only paid by workers whose tests actually
// load #services/pg/db. With `isolate: false` this still triggers on the first
// DB-using file in the worker; pure-unit-only workers skip CREATE DATABASE
// entirely. `__tachi_pg_loaded` is set in db.ts on module load.
let workerDbCreatedHere = false;
async function ensureWorkerDatabase() {
	if (workerDbCreatedHere) {
		return;
	}
	await createWorkerDatabase();
	workerDbCreatedHere = true;
}

beforeAll(async () => {
	const gFlags = globalThis as { __tachi_pg_loaded?: boolean };
	if (gFlags.__tachi_pg_loaded === true) {
		await ensureWorkerDatabase();
	}
});

beforeEach(async (ctx) => {
	// Benchmark tasks load real seed data in beforeAll; truncating here would wipe it
	// before every bench() and between iterations.
	const task = ctx.task as { file?: { filepath?: string }; meta?: { benchmark?: boolean } };

	if (task.meta?.benchmark === true) {
		return;
	}

	const fp = task.file?.filepath;

	if (typeof fp === "string" && fp.endsWith(".bench.ts")) {
		return;
	}

	// Skip the TRUNCATE / cache-reset work when this worker has not yet loaded
	// the DB at all (`__tachi_pg_loaded`, set in db.ts) or has not issued any
	// query since the last reset (`__tachi_pg_used`, set by the pool wrappers
	// in db.ts). Both are plain property reads on globalThis - no import cost
	// when the conditions are false. Worth roughly 0.5-2 ms per pure-unit
	// test in a mixed worker, and the DROP DATABASE / pool init cost on
	// workers that happen to be pure-unit only.
	const g = globalThis as unknown as {
		__tachi_pg_loaded?: boolean;
		__tachi_pg_used?: boolean;
	};

	if (g.__tachi_pg_loaded === true && g.__tachi_pg_used === true) {
		// Defensive: a test file that loads db.ts only inside an `it()` body
		// would skip our beforeAll gate, so re-check here.
		await ensureWorkerDatabase();
		const tReset0 = performance.now();
		await resetDatabase();
		g.__tachi_pg_used = false;
		if (TIMING) {
			const d = performance.now() - tReset0;
			resetCalls += 1;
			msResetDatabaseTotal += d;
			msResetDatabaseMax = Math.max(msResetDatabaseMax, d);
		}
	}

	// Login-heavy router tests share the in-memory login rate limiter; reset
	// each test so AggressiveRateLimit (15 / 10 min) does not 429 and omit
	// Set-Cookie. `__tachi_rate_limiter_loaded` is set on module load in
	// rate-limiter.ts so we skip the import entirely on workers that never
	// touch any router.
	const gRl = globalThis as unknown as { __tachi_rate_limiter_loaded?: boolean };
	if (gRl.__tachi_rate_limiter_loaded === true) {
		const tRl0 = performance.now();
		const { ClearTestingRateLimitCache } = await import("#server/middleware/rate-limiter");
		ClearTestingRateLimitCache();
		if (TIMING) {
			msRateLimitCacheTotal += performance.now() - tRl0;
		}
	}
});

// Per-file afterAll is deliberately a no-op with `isolate: false` - closing
// the pool or stopping the supertest server here would break subsequent
// files in the same worker. Worker-wide cleanup (DROP DATABASE, pool/server
// close) is the job of vitest.globalSetup.ts's teardown sweep + process exit.
afterAll(() => {
	if (TIMING) {
		const wallMs = performance.now() - workerWallStart;
		const avgReset = resetCalls > 0 ? msResetDatabaseTotal / resetCalls : 0;
		console.error(
			[
				`[vitest-timing] worker=${WORKER_ID}`,
				`create_db_ms=${msCreateWorkerDb.toFixed(1)}`,
				`reset_calls=${resetCalls}`,
				`reset_total_ms=${msResetDatabaseTotal.toFixed(1)}`,
				`reset_avg_ms=${avgReset.toFixed(1)}`,
				`reset_max_ms=${msResetDatabaseMax.toFixed(1)}`,
				`rate_limit_cache_reset_total_ms=${msRateLimitCacheTotal.toFixed(1)}`,
				`worker_wall_ms=${wallMs.toFixed(1)}`,
			].join(" "),
		);
	}
}, 60_000);
