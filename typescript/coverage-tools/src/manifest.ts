/**
 * Registry of Vitest packages that emit `coverage/coverage-final.json` when tests
 * run (coverage is enabled in each package’s `vitest.config`; see Justfile-test `test-typescript`).
 *
 * When you add a new workspace with Vitest + v8 coverage, append an entry here
 * and (if needed) point `coverageFinal` at that package’s reportsDirectory.
 */
export type CoverageSource = {
	/** Short id for `--packages` */
	id: string;
	/** Root package directory relative to the repo root (e.g. typescript/server) */
	packageRoot: string;
	/** Istanbul `coverage-final.json` path relative to the repo root */
	coverageFinal: string;
};

export const COVERAGE_SOURCES: readonly CoverageSource[] = [
	{
		id: "server",
		packageRoot: "typescript/server",
		coverageFinal: "typescript/server/coverage/coverage-final.json",
	},
	{
		id: "bot",
		packageRoot: "typescript/bot",
		coverageFinal: "typescript/bot/coverage/coverage-final.json",
	},
	{
		id: "rg-stats",
		packageRoot: "typescript/rg-stats",
		coverageFinal: "typescript/rg-stats/coverage/coverage-final.json",
	},
	{
		id: "common",
		packageRoot: "typescript/common",
		coverageFinal: "typescript/common/coverage/coverage-final.json",
	},
	{
		id: "db",
		packageRoot: "typescript/db",
		coverageFinal: "typescript/db/coverage/coverage-final.json",
	},
	{
		id: "sieglinde",
		packageRoot: "typescript/sieglinde",
		coverageFinal: "typescript/sieglinde/coverage/coverage-final.json",
	},
] as const;
