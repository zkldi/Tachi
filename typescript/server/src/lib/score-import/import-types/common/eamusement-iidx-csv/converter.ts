import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ChartDocument, GamesForGroup } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InvalidScoreFailure,
	SkipScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { AssertStrAsPositiveInt } from "#lib/score-import/framework/common/string-asserts";
import { FindChartWithSongDifficultyVersion } from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";

import type { ConverterFunction } from "../types";
import type { IIDXEamusementCSVContext, IIDXEamusementCSVData } from "./types";

const EAMUSEMENT_LAMP_RESOLVER: Map<string, GetEnumValue<GamesForGroup["iidx"], "lamp">> = new Map([
	["ASSIST CLEAR", "ASSIST CLEAR"],
	["CLEAR", "CLEAR"],
	["EASY CLEAR", "EASY CLEAR"],
	["EX HARD CLEAR", "EX HARD CLEAR"],
	["FAILED", "FAILED"],
	["FULLCOMBO CLEAR", "FULL COMBO"],
	["HARD CLEAR", "HARD CLEAR"],
	["NO PLAY", "NO PLAY"],
]);

const NINE_HOURS = 1000 * 60 * 60 * 9;

const ConvertEamIIDXCSV: ConverterFunction<
	IIDXEamusementCSVData,
	IIDXEamusementCSVContext
> = async (data, context, importType, log) => {
	const eamScore = data.score;

	if (eamScore.exscore === "0") {
		// skip scores with an exscore of 0
		// This also skips things like score resets.
		throw new SkipScoreFailure("Score has an exscore of 0.");
	}

	if (!eamScore.level || eamScore.level === "0") {
		// charts that dont exist in the format have a level of 0
		throw new SkipScoreFailure("Chart has a level of 0.");
	}

	let isLegacyLeggendaria = false;

	// if pre-HV, leggendarias were stored in a wacky form.
	if (!context.hasBeginnerAndLegg) {
		// hack fix for legacy LEGGENDARIA titles
		if (/(†|†LEGGENDARIA)$/u.exec(data.title)) {
			data.title = data.title.replace(/(†|†LEGGENDARIA)$/u, "").trimEnd();
			isLegacyLeggendaria = true;
		}
	}

	// @optimisable - This is actually a multi-fetch. Since eam-csv scores
	// are batched up into (song, chart1, chart2, chart3 ...) rows
	// we actually already have fetched this song a second ago.
	const tachiSong = await FindSongOnTitle("iidx", data.title);

	if (!tachiSong) {
		throw new SongOrChartNotFoundFailure(
			`Could not find song for ${data.title}.`,
			importType,
			data,
			context,
		);
	}

	const HUMANISED_CHART_TITLE = `${tachiSong.title} (${context.playtype} ${eamScore.difficulty} [v${context.importVersion}])`;

	if (isLegacyLeggendaria) {
		eamScore.difficulty = "LEGGENDARIA";
	}

	const game = context.playtype === "SP" ? "iidx-sp" : "iidx-dp";

	if (eamScore.difficulty === "BEGINNER") {
		throw new SkipScoreFailure("BEGINNER charts are not supported.");
	}

	const tachiChart = (await FindChartWithSongDifficultyVersion(
		game,
		tachiSong.id,
		eamScore.difficulty,
		context.importVersion,
	)) as ChartDocument<GamesForGroup["iidx"]> | null;

	if (!tachiChart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart for ${HUMANISED_CHART_TITLE}`,
			"file/eamusement-iidx-csv",
			data,
			context,
		);
	}

	const exscore = AssertStrAsPositiveInt(
		eamScore.exscore,
		`${HUMANISED_CHART_TITLE} - Invalid EX score of ${eamScore.exscore}`,
	);

	const MAX_EX = tachiChart.data.notecount * 2;

	if (exscore > MAX_EX) {
		throw new InvalidScoreFailure(
			`${HUMANISED_CHART_TITLE} - Invalid EX Score of ${eamScore.exscore} (Was greater than max chart ex of ${MAX_EX}).`,
		);
	}

	const pgreat = AssertStrAsPositiveInt(
		eamScore.pgreat,
		`${HUMANISED_CHART_TITLE} - Invalid PGreats of ${eamScore.pgreat}`,
	);

	const great = AssertStrAsPositiveInt(
		eamScore.great,
		`${HUMANISED_CHART_TITLE} - Invalid Greats of ${eamScore.pgreat}`,
	);

	if (pgreat * 2 + great !== exscore) {
		throw new InvalidScoreFailure(
			`${HUMANISED_CHART_TITLE} - PGreats * 2 + Greats did not equal EXScore (${pgreat} * 2 + ${great} != ${exscore}).`,
		);
	}

	const lamp = EAMUSEMENT_LAMP_RESOLVER.get(eamScore.lamp);

	if (!lamp) {
		log.info(`Invalid lamp of ${eamScore.lamp} provided.`);
		throw new InvalidScoreFailure(
			`${HUMANISED_CHART_TITLE} - Invalid Lamp of ${eamScore.lamp}.`,
		);
	}

	const timestamp = ParseDateFromString(data.timestamp);

	const dryScore: DryScore<typeof game> = {
		service: context.service,
		comment: null,
		game,
		importType,
		scoreData: {
			score: exscore,
			lamp,
			judgements: {
				pgreat,
				great,
			},
			optional: {},
		},
		scoreMeta: {},

		// japan is gmt+9
		timeAchieved: timestamp !== null ? timestamp - NINE_HOURS : null,
	};

	const numBP = Number(eamScore.bp);

	if (!Number.isNaN(numBP)) {
		if (!Number.isInteger(numBP) || numBP < 0 || numBP > 9999) {
			throw new InvalidScoreFailure(
				`${HUMANISED_CHART_TITLE} - Invalid BP of ${eamScore.bp}.`,
			);
		}

		dryScore.scoreData.optional.bp = numBP;
	} else if (eamScore.bp === "---") {
		log.debug(
			`Skipped assigning BP for score as it had expected null value of ${eamScore.bp}.`,
		);
	} else {
		log.info(`Skipped assigning BP for score. Had unexpected value of ${eamScore.bp}.`);
	}

	return { chart: tachiChart, dryScore, song: tachiSong };
};

export default ConvertEamIIDXCSV;
