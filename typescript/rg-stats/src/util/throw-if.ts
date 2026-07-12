/**
 * An object of variables to print if the predicate fails.
 */
export type ErrVars = Record<string, string | number>;

/**
 * Formats the errVars argument into a pretty string.
 */
function FormatErrVars(errVars: ErrVars) {
	const vars = [];

	for (const [key, value] of Object.entries(errVars)) {
		if (typeof value === "string") {
			// We have to replace "'s here with \" so that the output
			// doesn't get scrambled for certain maliciously crafted
			// strings.
			vars.push(`${key}="${value.replace(/"/gu, '\\"')}"`);
		} else {
			vars.push(`${key}=${value}`);
		}
	}

	return vars.join(", ");
}

/**
 * Throw if the condition is not true.
 *
 * @param condition - If false, throw a prettified error,
 * @param errMsg - The error message to display.
 * @param errVars - Variables to format and print out on failure.
 */
export function ThrowIf(condition: boolean, errMsg: string, errVars: ErrVars) {
	if (condition) {
		// Add a full stop incase we forget one.
		if (errMsg[errMsg.length - 1] !== ".") {
			errMsg += ".";
		}
		throw new Error(`Invalid input, ${errMsg} ${FormatErrVars(errVars)}.`);
	}
}

ThrowIf.not = (value: boolean, errMsg: string, errVars: ErrVars) =>
	ThrowIf(!value, errMsg, errVars);

ThrowIf.negative = (value: number, errMsg: string, errVars: ErrVars) =>
	ThrowIf(value < 0, errMsg, errVars);

ThrowIf.positive = (value: number, errMsg: string, errVars: ErrVars) =>
	ThrowIf(value > 0, errMsg, errVars);

ThrowIf.positiveOrZero = (value: number, errMsg: string, errVars: ErrVars) =>
	ThrowIf(value >= 0, errMsg, errVars);

ThrowIf.negativeOrZero = (value: number, errMsg: string, errVars: ErrVars) =>
	ThrowIf(value <= 0, errMsg, errVars);

ThrowIf.zero = (value: number, errMsg: string, errVars: ErrVars) =>
	ThrowIf(value === 0, errMsg, errVars);
