/**
 * Wraps a Kai async iterable and stops yielding once a score's timestamp is
 * at or before the given lastScoreTime cursor.  Kai play_history APIs return
 * scores newest-first, so the first item whose timestamp is <= lastScoreTime
 * marks the boundary of already-imported data.
 *
 * If lastScoreTime is null the source iterable is yielded through unchanged.
 */
export async function* applyKaiTimestop(
	source: AsyncIterable<unknown>,
	lastScoreTime: Date | null,
): AsyncIterable<unknown> {
	if (!lastScoreTime) {
		yield* source;
		return;
	}

	const cutoff = lastScoreTime.getTime();

	for await (const item of source) {
		const ts = (item as Record<string, unknown>).timestamp;

		if (typeof ts === "string") {
			const parsed = Date.parse(ts);

			if (!Number.isNaN(parsed) && parsed <= cutoff) {
				return;
			}
		}

		yield item;
	}
}
