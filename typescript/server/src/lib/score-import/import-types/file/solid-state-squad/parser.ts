import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { XMLParser } from "fast-xml-parser";
import { p, type PrudenceSchema } from "prudence";

import type { S3Score } from "./types";

const PR_SOLID_STATE: PrudenceSchema = {
	s3data: {
		userdata: {
			id: p.isPositiveInteger,
			login: "string",
			djname: "string",
		},
		scoredata: {
			song: [
				{
					id: p.isPositiveInteger,
					diff: p.isIn("L7", 7, "A", "B", 5, "L14", 14, "A14", "B14"),

					// The song title '.59' is automatically coerced into a float
					// by our XML parser. Despite the fact that it's in a CData field.
					// Regardless of the mess that is XML, we need to accept numbers in
					// this field, and then convert them back to strings later.
					//
					// Making a proper solution for this isn't possible, as the bowels
					// of the XML parser are inaccessible to us.
					// I *hate* XML.
					//
					// What a disaster.
					songname: p.or("string", "number"),
					styles: "string",

					exscore: p.isPositiveInteger,
					scorebreakdown: p.optional({
						justgreats: p.isPositiveInteger,
						greats: p.isPositiveInteger,
						good: p.isPositiveInteger,
						bad: p.isPositiveInteger,
						poor: p.isPositiveInteger,
					}),
					mods: {
						hardeasy: p.optional(p.isIn("H", "E")),
					},
					cleartype: p.isIn(
						"played",
						"cleared",
						"combo",
						"comboed",
						"perfect",
						"perfected",
					),
					date: "string",

					// loads of stuff is ignored from this and just defaults to any because we don't use it.
				},
			],
		},
	},
};

const xmlParser = new XMLParser();

// .59 is a song that is interpreted as a float by our XML parser.
// so is 2002 and 1989. I hate this parser.
type PreStringifiedS3Score = { songname: number | string } & Omit<S3Score, "songname">;

export function ParseSolidStateXML(
	fileData: Express.Multer.File,
	body: Record<string, unknown>,
	log: KtLogger,
): ParserFunctionReturns<S3Score, EmptyObject, GamesForGroup["iidx"]> {
	let parsedXML;

	try {
		// insanely hacky. This XML parser might return anything, but we still need
		// to traverse it as if it's normal!

		parsedXML = xmlParser.parse(fileData.buffer.toString("utf-8"));
	} catch (err) {
		log.info(err, "S3 XML Parse Error");

		throw new ScoreImportFatalError(400, "Could not parse XML.");
	}

	// the XML parser can't understand this is meant to be an array
	// if someone only has one score, so we need to override it in that case.
	// However, this results in us having to do some painful by-hand validation.
	// :(

	// @hack Poor typechecking here, but it's kind of painful any way you slice it.

	let maybeSongs: unknown = parsedXML?.s3data?.scoredata?.song;

	if (maybeSongs === undefined) {
		throw new ScoreImportFatalError(400, `Invalid S3 XML, no s3data -> scoredata -> song?`);
	}

	// If maybeSongs isn't an array, convert it to an array with one element.
	// Note that this is **before** we actually validate it's contents! So even if
	// this results in something stupid like [null], we still reject it in validation.
	if (!Array.isArray(maybeSongs)) {
		maybeSongs = [maybeSongs];
	}

	// Our validator checks the entire XML, lets mutate the original object
	// (which we know to exist now)

	parsedXML.s3data.scoredata.song = maybeSongs;

	const err = p(parsedXML, PR_SOLID_STATE, {}, { allowExcessKeys: true });

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid S3 XML."));
	}

	let scoreData = maybeSongs as Array<PreStringifiedS3Score>;

	scoreData = scoreData.map((e) => ({
		...e,

		// Songnames here are either numbers or strings due to a disgusting hack
		// @see #718
		// We forcibly convert all these back to strings.
		// Note that we can't even use the generic solution .toString, because the
		// song title is .59, not 0.59.
		// This is genuinely horrific.
		songname: e.songname === 0.59 ? ".59" : String(e.songname),
	}));

	return {
		service: "Solid State Squad",
		classProvider: null,
		context: {},
		iterable: scoreData as Array<S3Score>,
		gameGroup: "iidx",
	};
}
