import type { KtLogger } from "#lib/log/log";

const MAX_ATTEMPTS = 5;

function isRetryablePbError(err: unknown): boolean {
	if (typeof err !== "object" || err === null) {
		return false;
	}

	const { code, constraint } = err as { code?: unknown; constraint?: unknown };

	return (
		code === "40P01" || // deadlock_detected
		code === "40001" || // serialization_failure
		(code === "23505" && constraint === "chart_leaderboard_new_pkey")
	);
}

// pb reapplication is a bit flakey. i could fix this with complex lock logic
// but lets just retry a couple times.
export async function retryPbTransaction(
	runTransaction: () => Promise<void>,
	log: Pick<KtLogger, "warn">,
): Promise<void> {
	for (let attempt = 1; ; attempt++) {
		try {
			// eslint-disable-next-line no-await-in-loop -- the previous transaction must finish first
			await runTransaction();
			return;
		} catch (err) {
			if (attempt >= MAX_ATTEMPTS || !isRetryablePbError(err)) {
				throw err;
			}

			// 50-99, 100-199, 200-399, 400-799ms. Sleep only after rollback.
			const baseMs = 50 * 2 ** (attempt - 1);
			const delayMs = baseMs + Math.floor(Math.random() * baseMs);
			log.warn({ err, attempt, delayMs }, "Retrying PB transaction after a database race.");
			// eslint-disable-next-line no-await-in-loop -- back off before opening a new transaction
			await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
		}
	}
}
