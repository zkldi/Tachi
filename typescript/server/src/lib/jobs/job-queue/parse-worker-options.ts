export interface JobQueueWorkerOptions {
	workerCount: number;
}

/**
 * Resolve how many parallel worker loops to run.
 *
 * Priority (highest first):
 *   1. `--workers=N` / `--workers N` CLI argument
 *   2. `TACHI_JOB_QUEUE_WORKER_POOL` env var
 *   3. Default: 1
 *
 * Any non-integer or value < 1 is silently clamped to 1.
 */
export function parseJobQueueWorkerOptions(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
): JobQueueWorkerOptions {
	// CLI takes precedence over env.
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--workers") {
			const n = Number.parseInt(argv[i + 1] ?? "", 10);
			if (!Number.isNaN(n) && n >= 1) {
				return { workerCount: n };
			}
		} else if (arg?.startsWith("--workers=")) {
			const n = Number.parseInt(arg.slice("--workers=".length), 10);
			if (!Number.isNaN(n) && n >= 1) {
				return { workerCount: n };
			}
		}
	}

	const envVal = env.TACHI_JOB_QUEUE_WORKER_POOL;
	if (envVal !== undefined && envVal !== "") {
		const n = Number.parseInt(envVal, 10);
		if (!Number.isNaN(n) && n >= 1) {
			return { workerCount: n };
		}
	}

	return { workerCount: 1 };
}
