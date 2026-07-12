import type { PrudenceError } from "prudence";

/**
 * Formats a PrudenceError into something a little more readable.
 * @param err - The prudence error to format.
 * @param foreword - A description of what kind of error this was. Defaults to "Error".
 */
export function FormatPrError(err: PrudenceError, foreword = "Error"): string {
	const receivedText =
		typeof err.userVal === "object" && err.userVal !== null
			? ""
			: ` | Received ${err.userVal} [${err.userVal === null ? "null" : typeof err.userVal}]`;

	return `${foreword}: ${err.keychain} | ${err.message}${receivedText}.`;
}
