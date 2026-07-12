import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { CSVParseError, NaiveCSVParse } from "#utils/naive-csv-parser";

import type { SDVXEamusementCSVData } from "./types";

const HEADER_COUNT = 11;

// A SDVX CSV Row has exactly 11 elements. This is used for type safety.
type SDVXCSVRow = [
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
];

export default function ParseEamusementSDVXCSV(
	fileData: Express.Multer.File,
	_body: Record<string, unknown>,
	log: KtLogger,
): ParserFunctionReturns<SDVXEamusementCSVData, EmptyObject, GamesForGroup["sdvx"]> {
	let rawHeaders: Array<string>;
	let rawRows: Array<Array<string>>;

	try {
		({ rawHeaders, rawRows } = NaiveCSVParse(fileData.buffer, log));
	} catch (e) {
		// This is probably fine.
		if (e instanceof CSVParseError) {
			throw new ScoreImportFatalError(400, e.message);
		}

		throw e;
	}

	if (rawHeaders.length !== HEADER_COUNT) {
		log.info(`Invalid CSV header count of ${rawHeaders.length} received.`);
		throw new ScoreImportFatalError(
			400,
			"Invalid CSV provided. CSV does not have the correct number of headers.",
		);
	}

	// All of these are guaranteed to not be null by the CSV parser.
	// cells is guaranteed to have a length of exactly 11.
	const iterable = (rawRows as Array<SDVXCSVRow>).map((cells) => ({
		// Normalize all Unicode space separators (e.g. U+00A0 non-breaking space,
		// which the e-amusement CSV export uses in place of regular spaces) to
		// plain ASCII space so title lookups against the database succeed.
		title: cells[0].replace(/\p{Zs}/gu, " "),
		difficulty: cells[1],
		level: cells[2],
		lamp: cells[3],
		score: cells[5],
		exscore: cells[6],

		// The other columns (grade, # of different clears) are essentially useless.
		// There is no timestamp :(
	}));

	return {
		service: "e-amusement",
		iterable,
		context: {},
		gameGroup: "sdvx",
		classProvider: null,
	};
}
