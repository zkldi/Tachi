import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup, integer, Versions } from "tachi-common";

import {
	EXT_BISTROVER,
	EXT_CANNON_BALLERS,
	EXT_CASTHOUR,
	EXT_EPOLIS,
	EXT_HEROIC_VERSE,
	EXT_PINKYCRUSH,
	EXT_RESIDENT,
	EXT_ROOTAGE,
	MODEL_IIDX,
	MODEL_IIDX_LIGHTNING,
	MODEL_INFINITAS_2,
	REV_2DXTRA,
	REV_NORMAL,
	REV_OMNIMIX,
} from "#lib/constants/ea3id";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ParseEA3SoftID } from "#utils/ea3id";
import { FormatPrError, optNull } from "#utils/prudence";
import { p, type PrudenceSchema, type ValidSchemaValue } from "prudence";

import type { FervidexContext, FerHeaders as FervidexHeaders, FervidexScore } from "./types";

const PR_FERVIDEX: PrudenceSchema = {
	chart: p.isIn("spb", "spn", "dpn", "sph", "dph", "spa", "dpa", "spl", "dpl"),
	entry_id: p.isPositiveInteger,
	chart_sha256: "*string",
	custom: "*boolean",

	pgreat: p.isPositiveInteger,
	great: p.isPositiveInteger,
	good: p.isPositiveInteger,
	bad: p.isPositiveInteger,
	poor: p.isPositiveInteger,

	slow: p.isPositiveInteger,
	fast: p.isPositiveInteger,
	max_combo: p.optional(p.isPositiveInteger),
	combo_break: p.isPositiveInteger,

	ex_score: p.isPositiveInteger,
	clear_type: p.isBoundedInteger(0, 7),

	gauge: [p.isBoundedInteger(0, 255)],

	// no idea what this actually represents. array of ints.
	ghost: p.any,

	dead: p.optional({
		measure: optNull(p.isPositiveInteger),
		note: optNull(p.isPositiveInteger),
	} as unknown as ValidSchemaValue),

	option: p.optional({
		gauge: optNull(
			p.isIn(
				"ASSISTED_EASY",
				"EASY",
				"HARD",
				"EX_HARD",
				"EROSION_LV1",
				"EROSION_LV2",
				"EROSION_LV3",
				"EROSION_LV4",
				"EROSION_LV5",
			),
		),
		range: optNull(
			p.isIn("SUDDEN_PLUS", "HIDDEN_PLUS", "SUD_PLUS_HID_PLUS", "LIFT", "LIFT_SUD_PLUS"),
		),
		style: optNull(p.isIn("RANDOM", "R_RANDOM", "S_RANDOM", "MIRROR")),
		style_2p: optNull(p.isIn("RANDOM", "R_RANDOM", "S_RANDOM", "MIRROR")),
		assist: optNull(p.isIn("AUTO_SCRATCH", "LEGACY_NOTE", "ASCR_LEGACY", "FULL_ASSIST")),
	}),

	// we dont use it and we dont care.
	pacemaker: p.any,

	"2dx-gsm": p.optional({
		EASY: [p.isBoundedInteger(0, 255)],
		NORMAL: [p.isBoundedInteger(0, 255)],
		HARD: [p.isBoundedInteger(0, 255)],
		EX_HARD: [p.isBoundedInteger(0, 255)],
	}),

	highlight: p.optional("boolean"),
	duplicate: p.optional("boolean"),
};

/**
 * Converts a string of the form LDJ:X:X:X:2020092900 into a game version.
 */
export function SoftwareIDToVersion(model: string, log: KtLogger): Versions[GamesForGroup["iidx"]] {
	try {
		const data = ParseEA3SoftID(model);

		if (data.model === MODEL_INFINITAS_2) {
			return "inf";
		} else if (data.model === MODEL_IIDX || data.model === MODEL_IIDX_LIGHTNING) {
			// pretty icky yandere-dev tier if statements, but hey
			// that's just how it works...
			if (data.ext === EXT_CANNON_BALLERS) {
				if (data.rev === REV_NORMAL) {
					return "25";
				}
			} else if (EXT_ROOTAGE.includes(data.ext)) {
				if (data.rev === REV_OMNIMIX) {
					return "26-omni";
				} else if (data.rev === REV_NORMAL) {
					return "26";
				}
			} else if (data.ext === EXT_HEROIC_VERSE) {
				if (data.rev === REV_OMNIMIX) {
					return "27-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "27-2dxtra";
				} else if (data.rev === REV_NORMAL) {
					return "27";
				}
			} else if (data.ext === EXT_BISTROVER) {
				if (data.rev === REV_OMNIMIX) {
					return "28-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "28-2dxtra";
				} else if (data.rev === REV_NORMAL) {
					return "28";
				}
			} else if (data.ext === EXT_CASTHOUR) {
				if (data.rev === REV_NORMAL) {
					return "29";
				} else if (data.rev === REV_OMNIMIX) {
					return "29-omni";
				}
			} else if (EXT_RESIDENT.includes(data.ext)) {
				if (data.rev === REV_NORMAL) {
					return "30";
				} else if (data.rev === REV_OMNIMIX) {
					return "30-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "30-2dxtra";
				}
			} else if (EXT_EPOLIS.includes(data.ext)) {
				if (data.rev === REV_NORMAL) {
					return "31";
				} else if (data.rev === REV_OMNIMIX) {
					return "31-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "31-2dxtra";
				}
			} else if (EXT_PINKYCRUSH.includes(data.ext)) {
				if (data.rev === REV_NORMAL) {
					return "32";
				} else if (data.rev === REV_OMNIMIX) {
					return "32-omni";
				}
			}
		}

		throw new ScoreImportFatalError(400, `Unsupported Software Model ${model}.`);
	} catch (err) {
		log.warn({ err }, `Unsupported Software Model ${model}.`);
		throw new ScoreImportFatalError(400, `Unsupported Software Model ${model}.`);
	}
}

export function ParseFervidexSingle(
	body: Record<string, unknown>,
	headers: FervidexHeaders,
	userID: integer,
	log: KtLogger,
): ParserFunctionReturns<FervidexScore, FervidexContext, GamesForGroup["iidx"]> {
	const version = SoftwareIDToVersion(headers.model, log);

	// more mods may be added in the future, so lets ignore excess keys.
	const err = p(body, PR_FERVIDEX, undefined, { allowExcessKeys: true });

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid Fervidex Request?"));
	}

	// asserted using prudence.
	const score = body as unknown as FervidexScore;

	return {
		service: "Fervidex",
		// this import method needs to know the user making the request
		// in order to highlight existing scores. Neat!
		context: { version, timeReceived: Date.now(), userID },
		gameGroup: "iidx",
		iterable: [score],
		classProvider: null,
	};
}
