/** Discord allows at most this many choices on a slash string option. */
export const SLASH_STRING_CHOICE_LIMIT = 25;

/**
 * Sort strings alphabetically and split at `limit` (for slash command picker caps).
 *
 * Exported for tests.
 */
export function sortedSlashChoiceKeys(
	keys: Iterable<string>,
	limit = SLASH_STRING_CHOICE_LIMIT,
): { keysIncluded: string[]; keysOmitted: string[] } {
	const sorted = [...keys].sort((a, b) => a.localeCompare(b));

	return {
		keysIncluded: sorted.slice(0, limit),
		keysOmitted: sorted.slice(limit),
	};
}
