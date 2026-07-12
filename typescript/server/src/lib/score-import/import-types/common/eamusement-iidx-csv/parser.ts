import type { KtLogger } from "#lib/log/log";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { staticAssertUnreachable, StringIsGameVersion } from "#utils/misc";
import { CSVParseError, NaiveCSVParse } from "#utils/naive-csv-parser";
import { type GamesForGroup, type V3Game, type Versions } from "tachi-common";

import type { ParserFunctionReturns } from "../types";
import type { EamusementScoreData, IIDXEamusementCSVContext, IIDXEamusementCSVData } from "./types";

export enum EAM_VERSION_NAMES {
	"1st&substream" = 1,
	"2nd style" = 2,
	"3rd style" = 3,
	"4th style" = 4,
	"5th style" = 5,
	"6th style" = 6,
	"7th style" = 7,
	"8th style" = 8,
	"9th style" = 9,
	"10th style" = 10,
	BISTROVER = 28,
	"CANNON BALLERS" = 25,
	CastHour = 29,
	copula = 23,
	DistorteD = 13,
	"DJ TROOPERS" = 15,
	EMPRESS = 16,
	EPOLIS = 31,
	GOLD = 14,
	"HAPPY SKY" = 12,
	"HEROIC VERSE" = 27,
	"IIDX RED" = 11,
	Lincle = 19,
	PENDUAL = 22,
	"Pinky Crush" = 32,
	RESIDENT = 30,
	"Resort Anthem" = 18,
	Rootage = 26,
	SINOBUZ = 24,
	SIRIUS = 17,
	SPADA = 21,
	"Sparkle Shower" = 33,
	tricoro = 20,
}

const PRE_HV_HEADER_COUNT = 27;
const HV_HEADER_COUNT = 41;

// commented out for reference
// [
//     "version",
//     "title",
//     "genre",
//     "artist",
//     "playcount",
//     (?beginnerdata)
//     "normal-level",
//     "normal-exscore",
//     "normal-pgreat",
//     "normal-great",
//     "normal-bp",
//     "normal-lamp",
//     "normal-grade",
//     "hyper-level",
//     "hyper-exscore",
//     "hyper-pgreat",
//     "hyper-great",
//     "hyper-bp",
//     "hyper-lamp",
//     "hyper-grade",
//     "another-level",
//     "another-exscore",
//     "another-pgreat",
//     "another-great",
//     "another-bp",
//     "another-lamp",
//     "another-grade",
//     (?leggdata)
//     "timestamp",
// ];

export function ResolveHeaders(headers: Array<string>, log: KtLogger) {
	if (headers.length === PRE_HV_HEADER_COUNT) {
		log.debug("PRE_HV csv received.");
		return {
			hasBeginnerAndLegg: false,
		};
	} else if (headers.length === HV_HEADER_COUNT) {
		log.debug("HV+ csv received.");
		return {
			hasBeginnerAndLegg: true,
		};
	}

	log.info(`Invalid CSV header count of ${headers.length} received.`);
	throw new ScoreImportFatalError(
		400,
		"Invalid CSV provided. CSV does not have the correct amount of headers.",
	);
}

export function IIDXCSVParse(csvBuffer: Buffer, playtype: "DP" | "SP", log: KtLogger) {
	let rawHeaders: Array<string>;
	let rawRows: Array<Array<string>>;

	try {
		({ rawHeaders, rawRows } = NaiveCSVParse(csvBuffer, log));
	} catch (e) {
		// this is probably fine
		if (e instanceof CSVParseError) {
			throw new ScoreImportFatalError(400, e.message);
		}

		throw e;
	}

	const { hasBeginnerAndLegg } = ResolveHeaders(rawHeaders, log);

	const diffs = hasBeginnerAndLegg
		? (["beginner", "normal", "hyper", "another", "leggendaria"] as const)
		: (["normal", "hyper", "another"] as const);

	const iterableData = [];

	let gameVersion = 0;

	for (const cells of rawRows) {
		const version = cells[0]!;
		const title = cells[1]!.trim();
		const timestamp = cells[rawHeaders.length - 1]!.trim();

		// @ts-expect-error this indexing is fine. grow up.
		const versionNum = EAM_VERSION_NAMES[version] as number | undefined;

		if (versionNum === undefined) {
			log.info(`Invalid/Unsupported EAM_VERSION_NAME ${version}.`);
			throw new ScoreImportFatalError(
				400,
				`Invalid/Unsupported Eamusement Version Name ${version}.`,
			);
		}

		if (versionNum > gameVersion) {
			gameVersion = versionNum;
		}

		const scores: Array<EamusementScoreData> = [];

		for (let d = 0; d < diffs.length; d++) {
			const diff = diffs[d]!;
			const di = 5 + d * 7;

			// lazy non-null assertions here.
			// @todo refactor this?
			// We know for a fact that all of this stuff is non-null because of the CSV parser.
			scores.push({
				difficulty: diff.toUpperCase() as Uppercase<typeof diff>,
				bp: cells[di + 4]!,
				exscore: cells[di + 1]!,
				pgreat: cells[di + 2]!,
				great: cells[di + 3]!,
				lamp: cells[di + 5]!,
				level: cells[di]!,
			});
		}

		iterableData.push(
			...scores.map((e) => ({
				score: e,
				timestamp,
				title,
			})),
		);
	}

	let game: V3Game;
	switch (playtype) {
		case "SP":
			game = "iidx-sp";
			break;
		case "DP":
			game = "iidx-dp";
			break;
		default:
			staticAssertUnreachable(playtype);
	}

	if (!StringIsGameVersion(game, gameVersion.toString())) {
		throw new ScoreImportFatalError(
			400,
			`Unsupported version '${gameVersion}'. Is your CSV properly filled out?`,
		);
	}

	return {
		iterableData,
		version: gameVersion.toString() as Versions[GamesForGroup["iidx"]],
		hasBeginnerAndLegg,
	};
}

/**
 * Parses a buffer of EamusementCSV data.
 * @param fileData - The buffer to parse.
 * @param body - The request body that made this file import request. Used to infer playtype.
 */
function GenericParseEamIIDXCSV(
	fileData: Express.Multer.File,
	body: Record<string, unknown>,
	service: string,
	log: KtLogger,
): ParserFunctionReturns<IIDXEamusementCSVData, IIDXEamusementCSVContext, GamesForGroup["iidx"]> {
	let playtype: "DP" | "SP";

	if (body.playtype === "SP") {
		playtype = "SP";
	} else if (body.playtype === "DP") {
		playtype = "DP";
	} else {
		log.info(`Invalid playtype of ${body.playtype} passed to ParseEamusementCSV.`);
		throw new ScoreImportFatalError(400, `Invalid playtype of ${body.playtype} given.`);
	}

	const lowercaseFilename = fileData.originalname.toLowerCase();

	if (
		body.assertPlaytypeCorrect === undefined &&
		((lowercaseFilename.includes("sp") && playtype === "DP") ||
			(lowercaseFilename.includes("dp") && playtype === "SP"))
	) {
		log.info(
			`File was uploaded with filename ${fileData.originalname}, but this was set as a ${playtype} import. Sanity check refusing.`,
		);

		throw new ScoreImportFatalError(
			400,
			`Safety Triggered: Filename contained '${
				playtype === "SP" ? "DP" : "SP"
			}', but was marked as a ${playtype} import. Are you *absolutely* sure this is right?`,
		);
	}

	const { hasBeginnerAndLegg, version, iterableData } = IIDXCSVParse(
		fileData.buffer,
		playtype,
		log,
	);

	log.debug("Successfully parsed CSV.");

	const context: IIDXEamusementCSVContext = {
		playtype,
		importVersion: version,
		hasBeginnerAndLegg,
		service,
	};

	log.debug(`Successfully Parsed with ${iterableData.length} results.`);

	return {
		service,
		iterable: iterableData,
		context,
		gameGroup: "iidx",
		classProvider: null,
	};
}

export default GenericParseEamIIDXCSV;
