import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";

import {
	InternalFailure,
	InvalidScoreFailure,
	SkipScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { CreateScoreID } from "#lib/score-import/framework/score-importing/score-id";
import DB from "#services/pg/db";
import { DeleteUndefinedProps, IsNullishOrEmptyStr } from "#utils/misc";
import { FindIIDXChartOnInGameIDVersion, FindIIDXChartWith2DXtraHash } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";
import { type Difficulties, type GamesForGroup } from "tachi-common";

import type { FervidexContext, FervidexScore } from "./types";

export const FERVIDEX_LAMP_LOOKUP = {
	0: "NO PLAY",
	1: "FAILED",
	2: "ASSIST CLEAR",
	3: "EASY CLEAR",
	4: "CLEAR",
	5: "HARD CLEAR",
	6: "EX HARD CLEAR",
	7: "FULL COMBO",
} as const;

export function TachifyAssist(
	assist: Required<FervidexScore>["option"]["assist"],
): DryScore<GamesForGroup["iidx"]>["scoreMeta"]["assist"] {
	switch (assist) {
		case "FULL_ASSIST":
		case "ASCR_LEGACY":
			return "FULL ASSIST";
		case "AUTO_SCRATCH":
			return "AUTO SCRATCH";
		case "LEGACY_NOTE":
			return "LEGACY NOTE";
		case null:
		case undefined:
			return "NO ASSIST";
	}
}

export function TachifyGauge(
	gauge: Required<FervidexScore>["option"]["gauge"],
): DryScore<GamesForGroup["iidx"]>["scoreMeta"]["gauge"] {
	switch (gauge) {
		case "ASSISTED_EASY":
			return "ASSISTED EASY";
		case "EASY":
			return "EASY";
		case "EX_HARD":
			return "EX-HARD";
		case "HARD":
			return "HARD";
		case null:
		case undefined:
		case "EROSION_LV1":
		case "EROSION_LV2":
		case "EROSION_LV3":
		case "EROSION_LV4":
		case "EROSION_LV5":
			return "NORMAL";
	}
}

export function TachifyRange(
	gauge: Required<FervidexScore>["option"]["range"],
): DryScore<GamesForGroup["iidx"]>["scoreMeta"]["range"] {
	switch (gauge) {
		case "HIDDEN_PLUS":
			return "HIDDEN+";
		case "LIFT":
			return "LIFT";
		case "LIFT_SUD_PLUS":
			return "LIFT SUD+";
		case "SUDDEN_PLUS":
			return "SUDDEN+";
		case "SUD_PLUS_HID_PLUS":
			return "SUD+ HID+";
		case null:
		case undefined:
			return "NONE";
	}
}

export function TachifyRandom(gauge: Required<FervidexScore>["option"]["style"]) {
	switch (gauge) {
		case "RANDOM":
			return "RANDOM";
		case "S_RANDOM":
			return "S-RANDOM";
		case "R_RANDOM":
			return "R-RANDOM";
		case "MIRROR":
			return "MIRROR";
		case null:
		case undefined:
			return "NONRAN";
	}
}

export function SplitFervidexChartRef(ferDif: FervidexScore["chart"]) {
	let game: "iidx-dp" | "iidx-sp";

	if (ferDif.startsWith("sp")) {
		game = "iidx-sp";
	} else {
		game = "iidx-dp";
	}

	let difficulty: Difficulties[GamesForGroup["iidx"]];

	switch (ferDif[ferDif.length - 1]) {
		case "b":
			throw new SkipScoreFailure(`BEGINNER charts are not supported.`);

		case "n": {
			difficulty = "NORMAL";
			break;
		}

		case "h": {
			difficulty = "HYPER";
			break;
		}

		case "a": {
			difficulty = "ANOTHER";
			break;
		}

		case "l": {
			difficulty = "LEGGENDARIA";
			break;
		}

		default:
			throw new InternalFailure(`Invalid fervidex difficulty of ${ferDif}`);
	}

	return { game, difficulty };
}

export const ConverterIRFervidex: ConverterFunction<FervidexScore, FervidexContext> = async (
	data,
	context,
	importType,
	log,
) => {
	// eslint-disable-next-line prefer-const
	let { difficulty, game } = SplitFervidexChartRef(data.chart);

	// Scripted Long used to be an ANOTHER with id 21201
	//
	// now it has an id of 12250 and is a legg.
	// Versions of omnimix prior to oct 2023 depend on this behaviour.
	if (data.entry_id === 21201 && difficulty === "ANOTHER") {
		data.entry_id = 12250;
		difficulty = "LEGGENDARIA";
	}

	let chart;

	if (data.custom === true) {
		if (IsNullishOrEmptyStr(data.chart_sha256)) {
			throw new InvalidScoreFailure("Score has no chart_sha256 but is a custom?");
		}

		chart = await FindIIDXChartWith2DXtraHash(data.chart_sha256);
	} else {
		chart = await FindIIDXChartOnInGameIDVersion(
			game,
			data.entry_id,
			difficulty,
			context.version,
		);
	}

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${data.entry_id} (${game} ${difficulty} [${context.version}])`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("iidx", chart.song.id);

	if (!song) {
		log.error(`Song ${chart.song.id} (iidx) has no parent song?`);
		throw new InternalFailure(`Song ${chart.song.id} (iidx) has no parent song?`);
	}

	const gaugeHistory = data.gauge.map((e) => (e > 200 ? null : e));

	const gauge = gaugeHistory[gaugeHistory.length - 1];

	// If gauge exists and is greater than 100
	// must be invalid
	if ((gauge ?? 0) > 100) {
		throw new InvalidScoreFailure(`Invalid value of gauge ${gauge}.`);
	}

	let bp: number | null = data.bad + data.poor;

	if (data.dead) {
		bp = null;
	}

	const dryScore: DryScore<typeof game> = {
		game,
		service: "Fervidex",
		comment: null,
		importType: "ir/fervidex",
		timeAchieved: context.timeReceived,
		scoreData: {
			score: data.ex_score,
			lamp: FERVIDEX_LAMP_LOOKUP[data.clear_type],
			judgements: {
				pgreat: data.pgreat,
				great: data.great,
				good: data.good,
				bad: data.bad,
				poor: data.poor,
			},
			optional: {
				fast: data.fast,
				slow: data.slow,
				maxCombo: null,
				gaugeHistory,
				scoreHistory: data.ghost,
				gauge,
				bp,
				comboBreak: data.combo_break,
				gsmEasy: data["2dx-gsm"]?.EASY,
				gsmNormal: data["2dx-gsm"]?.NORMAL,
				gsmHard: data["2dx-gsm"]?.HARD,
				gsmEXHard: data["2dx-gsm"]?.EX_HARD,
			},
		},
		scoreMeta: {
			assist: TachifyAssist(data.option?.assist),
			gauge: TachifyGauge(data.option?.gauge),

			random:
				game === "iidx-sp"
					? TachifyRandom(data.option?.style)
					: [TachifyRandom(data.option?.style), TachifyRandom(data.option?.style_2p)],
			range: TachifyRange(data.option?.range),
		},
	};

	// remove undefined props so CreateScoreID doesn't fail...
	DeleteUndefinedProps(dryScore);

	// When [9] is pressed on the keypad in game, Fervidex will send the score (again)
	// marked as a duplicate, but with highlight set. As such, we should highlight
	// the score this is for.
	if (data.highlight === true) {
		const scoreID = CreateScoreID(game, context.userID, dryScore, chart.legacyChartID);

		await DB.transaction().execute(async (trx) => {
			const scoreRow = await trx
				.selectFrom("score")
				.select("chart_id")
				.where("id", "=", scoreID)
				.where("user_id", "=", context.userID)
				.executeTakeFirst();

			if (!scoreRow) {
				return;
			}

			await trx
				.updateTable("score")
				.set({ highlight: true })
				.where("id", "=", scoreID)
				.execute();

			await trx
				.updateTable("pb")
				.set({ highlight: true })
				.where("user_id", "=", context.userID)
				.where("chart_id", "=", scoreRow.chart_id)
				.execute();
		});

		// now, just continue on with the regular import process. We already handle
		// discarding duplicates, so this shouldn't matter.
	}

	return { song, chart, dryScore };
};
