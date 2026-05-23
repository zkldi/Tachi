import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** When set (e.g. `test:coverage:set-user-supporter`), enforce 100% coverage on that file only. */
const coverageSupporterActionOnly = process.env.VITEST_COVERAGE_SUPPORTER_ACTION === "1";

/**
 * Coverage is opt-in: gated on `VITEST_COVERAGE=1` (CI's coverage job sets this,
 * `just coverage-report` flips it on too). Keeping coverage off in the default
 * developer/watch path is the single biggest vitest config lever - V8 coverage
 * adds substantial overhead per worker even when nobody is reading the report.
 *
 * The supporter-action focussed run also forces coverage on (it inspects a
 * specific file's percentages).
 */
const coverageEnabled = process.env.VITEST_COVERAGE === "1" || coverageSupporterActionOnly;

/** Allow CI to dial worker count down (default: all cores, capped to keep PG happy). */
function envInt(name: string, fallback: number): number {
	const v = process.env[name];
	if (v === undefined || v === "") {
		return fallback;
	}
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const cpuCount = os.cpus().length;
// With `isolate: false` (see below) the per-file collect/setup cost is paid
// once per worker, not once per file. Each additional worker therefore costs
// a fresh ~2 s of module evaluation + a long-lived Postgres DB whose tables
// accumulate bloat (autovacuum is off on the tmpfs test PG for speed) over
// the ~25-30 files it processes. Cap at 8 to keep the tmpfs footprint
// bounded; past ~8 threads on a normal box we are CPU-saturated anyway.
const maxWorkers = envInt("VITEST_MAX_WORKERS", Math.min(cpuCount, 8));
const minWorkers = envInt("VITEST_MIN_WORKERS", Math.min(maxWorkers, cpuCount));

export default defineConfig({
	resolve: {
		// Map #* path aliases to src/* so vite-node resolves them correctly.
		alias: [
			{
				find: /^#(.+)/u,
				replacement: `${path.resolve(__dirname, "src")}/$1`,
			},
		],
	},

	// Cache vite-node's transform results on disk so cold starts in CI (and in
	// fresh dev containers) re-use prior compilation work.
	cacheDir: path.resolve(__dirname, ".vite-cache"),

	test: {
		passWithNoTests: true,

		// resetDatabase() per test can exceed Vitest defaults under parallel workers.
		testTimeout: 20_000,
		hookTimeout: 60_000,

		// `vitest bench` uses this same config: globalSetup + setupFiles + per-worker POSTGRES_URL.
		// Use for API / DB performance work as well as microbenches (*.bench.ts).
		//
		// Static env vars. POSTGRES_URL is set dynamically per-worker in vitest.setup.ts
		// so each worker gets its own isolated database. App config (`TACHI_*`) comes from `.env.test`
		// loaded in `config.ts` (NODE_ENV must be `test` before that import).
		env: {
			NODE_ENV: "test",
			PORT: "8080",
			REDIS_URL: "tachi-redis",
			MIGRATIONS_DIR: "/tachi/db/migrations",
			LOG_LEVEL: "warn",
			VERSION: "test",
			VERSION_DETAIL: "test-detail",
		},

		// Parallel test execution. Each worker is a thread (not a fork) - thread
		// startup is dramatically cheaper than process forking. `isolate: false`
		// keeps the module graph alive across every test file a worker
		// processes; with ~218 files split across ~8 worker threads, the
		// alternative (`isolate: true`) re-evaluates Kysely + the full Express
		// router tree ~218 times instead of ~8, which dominates the per-file
		// "fixed overhead" budget. Per-test DB state is still reset in
		// vitest.setup.ts's beforeEach, and the worker DB lifecycle is
		// per-worker (not per-file) so re-using the pool across files is safe.
		//
		// EXCEPTION: a handful of files use `vi.mock(...)` to swap out modules
		// like `bms-table-loader` or `tachi-common`. With `isolate: false` the
		// vite-node module cache is shared across files in a worker, which
		// breaks vitest's per-file mock scoping (the mock factory does not
		// reliably take effect against an already-cached module). Those files
		// are routed through a separate project that runs with the default
		// `isolate: true`. The split keeps the fast path fast without giving
		// up the correctness of `vi.mock` for the handful of files that need
		// it.
		fileParallelism: true,
		globalSetup: "./vitest.globalSetup.ts",
		setupFiles: "./vitest.setup.ts",
		pool: "threads",
		poolOptions: {
			threads: {
				singleThread: false,
				isolate: false,
				useAtomics: true,
				minThreads: minWorkers,
				maxThreads: maxWorkers,
			},
		},
		maxWorkers,
		minWorkers,

		// `vi.mock(...)` users - run with full per-file isolation.
		// Keep this list short; if it grows, revisit the mocking approach
		// (e.g. dependency injection) rather than expanding the isolated set.
		projects: [
			{
				extends: true,
				test: {
					name: "default",
					exclude: ["src/actions/bms-table-sync.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "isolated",
					include: ["src/actions/bms-table-sync.test.ts"],
					poolOptions: {
						threads: {
							isolate: true,
						},
					},
				},
			},
		],

		...(coverageEnabled
			? {
					coverage: {
						enabled: true,
						provider: "v8",
						// Defaults plus lcov; `json` emits coverage-final.json for tachi-coverage-tools.
						reporter: ["text", "html", "clover", "json", "lcov"],
						include: ["src/**/*.ts"],
						exclude: ["src/**/*.test.ts", "src/**/*.bench.ts", "src/test-utils/**"],
						...(coverageSupporterActionOnly
							? {
									thresholds: {
										lines: 100,
										branches: 100,
										functions: 100,
										statements: 100,
									},
								}
							: {}),
					},
				}
			: { coverage: { enabled: false } }),
	},
});
