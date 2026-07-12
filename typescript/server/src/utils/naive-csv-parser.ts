import { type KtLogger } from "#lib/log/log";

import { IsNonEmptyString } from "./misc";

export class CSVParseError extends Error {
	constructor(description: string) {
		super(description);
		this.name = "CSVParseError";
	}
}

/**
 * Parse a "naive CSV". A Naive CSV is one that does not properly escape " or , characters.
 * This also means that if konami ever have a song that has a comma, it will cause some serious problems.
 *
 * The reason we have a handrolled CSV parser instead of using an existing library is because eamusement CSVs are
 * invalid -- due to their lack of escaping. We have to do very manual parsing to actually make this work!
 */
export function NaiveCSVParse(csvBuffer: Buffer, log: KtLogger) {
	const csvString = csvBuffer.toString("utf-8");

	const csvData = csvString.split("\n");

	const rawHeaders = [];
	let headerLen = 0;
	let curStr = "";

	if (!IsNonEmptyString(csvData[0])) {
		throw new CSVParseError(`Expected headers, but received nothing in the first row.`);
	}

	// looks like we're doing it like this.
	for (const char of csvData[0]) {
		headerLen++;

		// safety checks to avoid getting DOS'd
		if (headerLen > 1000) {
			throw new CSVParseError("Headers were longer than 1000 characters long.");
		} else if (rawHeaders.length >= 50) {
			// this does not *really* do what it seems.
			// because there's inevitably something left in curStr in this fn
			// this means that the above check is actually > 50 headers. Not
			// >= 50.
			throw new CSVParseError("Too many CSV headers.");
		}

		if (char === ",") {
			rawHeaders.push(curStr);
			curStr = "";
		} else {
			curStr = curStr + char;
		}
	}

	rawHeaders.push(curStr);

	const rawRows = [];

	for (const [rowNumber, data] of Object.entries(csvData).slice(1)) {
		// @security: This should probably be safetied from DOSing
		const cells = data.split(",").map((e) => {
			// we want to remove quotes from anything that is *absolutely*
			// surrounded by quotes.
			// Even though we are naively parsing csvs, it seems like at least
			// one person managed to mangle their inputs such that this happened.
			const isSurroundedByQuotes = /^"(.*)"$/u.exec(e) as [string, string] | null;

			if (isSurroundedByQuotes) {
				return isSurroundedByQuotes[1]; // unwrap the quotes
			}

			// do nothing
			return e;
		});

		// an empty string split on "," is an array with one empty value.
		if (cells.length === 1) {
			log.debug(`Skipped empty row ${rowNumber}.`);
			continue;
		}

		if (cells.length !== rawHeaders.length) {
			log.info(
				{
					data,
				},
				`csv has row (${rowNumber}) with invalid cell count of ${cells.length}, rejecting.`,
			);
			throw new CSVParseError(
				`Row ${rowNumber} has an invalid amount of cells (${cells.length}, expected ${rawHeaders.length}).`,
			);
		}

		rawRows.push(cells);
	}

	return {
		rawHeaders,
		rawRows,
	};
}
