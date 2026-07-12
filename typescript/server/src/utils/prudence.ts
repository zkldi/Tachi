import { p, type PrudenceError, type ValidSchemaValue } from "prudence";

export function FormatPrError(err: PrudenceError, foreword = "Error") {
	const receivedText =
		typeof err.userVal === "object" && err.userVal !== null
			? ""
			: ` | Received ${err.userVal} [type: ${
					err.userVal === null ? "null" : typeof err.userVal
				}]`;

	return `${foreword}: ${err.keychain ?? "null"} | ${err.message}${receivedText}.`;
}

export const optNull = (v: ValidSchemaValue) => p.optional(p.nullable(v));

export const optNullFluffStrField = optNull(p.isBoundedString(3, 140));
