/**
 * Merge provided options with a set of defaults.
 * @param userOptions - The user given options.
 * @param defaultOptions - Defaults to set if the user hasn't provided a value for
 * that option.
 *
 * @returns An options object that has no missing keys.
 */
export function MergeOptionsWithDefaults<T extends object>(
	userOptions: Partial<T>,
	defaultOptions: T,
): T {
	return Object.assign({}, defaultOptions, userOptions);
}
