import type {
	ChartSpecificMetricValidator,
	GPTChartSpecificMetricValidators,
	GPTClassDerivers,
	GPTProfileCalcs,
	GPTScoreCalcs,
	GPTScoreDeriver,
	GPTSessionCalcs,
	PBMergeFunction,
	PBRankingValuesFunction,
	ScoreValidator,
} from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN, ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { Volforce } from "rg-stats";
import {
	type ChartDocument,
	GetGrade,
	IIDXLikeGetGrade,
	type integer,
	type ScoreDocument,
	SDVXLIKE_GBOUNDARIES,
	type SpecificUserGameStats,
	type V3Game,
} from "tachi-common";

/** BMS/PMS v3 games (e.g. `bms:7K` → `bms-7k`). */
type BmsPmsGames = "bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard";

/** IIDX/BMS/PMS shared chart logic (e.g. `iidx:SP` → `iidx-sp`). */
type IIDXLikes = "iidx-dp" | "iidx-sp" | BmsPmsGames;

/** SDVX and USC v3 games (`sdvx:Single` → `sdvx`; `usc:Controller` → `usc-controller`). */
type SDVXLikes = "sdvx" | "usc-controller" | "usc-keyboard";

export const EX_SCORE_CHECK: ChartSpecificMetricValidator<IIDXLikes> = (exScore, chart) => {
	if (exScore < 0) {
		return `EX Score cannot be negative.`;
	}

	if (exScore > chart.data.notecount * 2) {
		return `EX Score cannot be greater than ${chart.data.notecount * 2} for this chart.`;
	}

	return true;
};

function calculateIIDXLikePercent(exScore: integer, notecount: integer) {
	return (100 * exScore) / (notecount * 2);
}

export const IIDXLIKE_SCORE_DERIVER: GPTScoreDeriver<IIDXLikes> = (scoreData, chart) => ({
	percent: calculateIIDXLikePercent(scoreData.score, chart.data.notecount),
	grade: IIDXLikeGetGrade(scoreData.score, chart.data.notecount),
});

export const IIDXLIKE_VALIDATORS: GPTChartSpecificMetricValidators<IIDXLikes> = {
	score: EX_SCORE_CHECK,
};

export const IIDXLIKE_SCORE_VALIDATORS: Array<ScoreValidator<IIDXLikes>> = [
	(s) => {
		const { pgreat, great } = s.scoreData.judgements;

		if (IsNullish(pgreat) || IsNullish(great)) {
			return;
		}

		if (pgreat * 2 + great !== s.scoreData.score) {
			return `Expected PGreat*2 + Great to equal EX score. Got ${pgreat}*2 + ${great} but that wasn't equal to the EX score of ${s.scoreData.score}.`;
		}
	},
];

export const SDVXLIKE_SCORE_DERIVER: GPTScoreDeriver<SDVXLikes> = (scoreData, _chart) => ({
	grade: GetGrade(SDVXLIKE_GBOUNDARIES, scoreData.score),
});

export const IIDXLIKE_PB_RANKING_VALUES: PBRankingValuesFunction<IIDXLikes> = (pb) => ({
	ranking: pb.scoreData.score,
	tb1: pb.scoreData.enumIndexes.lamp,
	tb2: pb.scoreData.optional.bp ?? null,
	tb3: null,
	tb4: null,
	tb5: null,
});

export function VF7ToClass(vf: number): SpecificUserGameStats<"sdvx">["classes"]["vfClass"] {
	// jesus christ man
	if (vf >= 23) {
		return "IMPERIAL_IV";
	} else if (vf >= 22) {
		return "IMPERIAL_III";
	} else if (vf >= 21) {
		return "IMPERIAL_II";
	} else if (vf >= 20) {
		return "IMPERIAL_I";
	} else if (vf >= 19.75) {
		return "CRIMSON_IV";
	} else if (vf >= 19.5) {
		return "CRIMSON_III";
	} else if (vf >= 19.25) {
		return "CRIMSON_II";
	} else if (vf >= 19) {
		return "CRIMSON_I";
	} else if (vf >= 18.75) {
		return "ELDORA_IV";
	} else if (vf >= 18.5) {
		return "ELDORA_III";
	} else if (vf >= 18.25) {
		return "ELDORA_II";
	} else if (vf >= 18) {
		return "ELDORA_I";
	} else if (vf >= 17.75) {
		return "ARGENTO_IV";
	} else if (vf >= 17.5) {
		return "ARGENTO_III";
	} else if (vf >= 17.25) {
		return "ARGENTO_II";
	} else if (vf >= 17) {
		return "ARGENTO_I";
	} else if (vf >= 16.75) {
		return "CORAL_IV";
	} else if (vf >= 16.5) {
		return "CORAL_III";
	} else if (vf >= 16.25) {
		return "CORAL_II";
	} else if (vf >= 16) {
		return "CORAL_I";
	} else if (vf >= 15.75) {
		return "SCARLET_IV";
	} else if (vf >= 15.5) {
		return "SCARLET_III";
	} else if (vf >= 15.25) {
		return "SCARLET_II";
	} else if (vf >= 15) {
		return "SCARLET_I";
	} else if (vf >= 14.75) {
		return "CYAN_IV";
	} else if (vf >= 14.5) {
		return "CYAN_III";
	} else if (vf >= 14.25) {
		return "CYAN_II";
	} else if (vf >= 14) {
		return "CYAN_I";
	} else if (vf >= 13.5) {
		return "DANDELION_IV";
	} else if (vf >= 13) {
		return "DANDELION_III";
	} else if (vf >= 12.5) {
		return "DANDELION_II";
	} else if (vf >= 12) {
		return "DANDELION_I";
	} else if (vf >= 11.5) {
		return "COBALT_IV";
	} else if (vf >= 11) {
		return "COBALT_III";
	} else if (vf >= 10.5) {
		return "COBALT_II";
	} else if (vf >= 10) {
		return "COBALT_I";
	} else if (vf >= 7.5) {
		return "SIENNA_IV";
	} else if (vf >= 5) {
		return "SIENNA_III";
	} else if (vf >= 2.5) {
		return "SIENNA_II";
	}

	return "SIENNA_I";
}

export const SDVXLIKE_SCORE_CALCS: GPTScoreCalcs<SDVXLikes> = (scoreData, _derivedData, chart) => ({
	VF6: Volforce.calculateVF6(scoreData.score, scoreData.lamp, chart.levelNum),
	VF7: Volforce.calculateVF7(scoreData.score, scoreData.lamp, chart.levelNum),
});

export const SDVXLIKE_SESSION_CALCS: GPTSessionCalcs<SDVXLikes> = (arr) => {
	const v = SessionAvgBest10For("VF6")(arr);
	const v2 = SessionAvgBest10For("VF7")(arr);

	return {
		ProfileVF6: v !== null ? v * 50 : null,
		ProfileVF7: v2 !== null ? v2 * 50 : null,
	};
};

export const SDVXLIKE_PROFILE_CALCS: GPTProfileCalcs<SDVXLikes> = async (game, userID) => ({
	VF6: await ProfileSumBestN("VF6", 50)(game, userID),
	VF7: await ProfileSumBestN("VF7", 50)(game, userID),
});

export const SDVXLIKE_CLASS_DERIVERS: GPTClassDerivers<SDVXLikes> = (ratings) => ({
	vfClass: IsNullish(ratings.VF7) ? null : VF7ToClass(ratings.VF7),
});

export const SDVXLIKE_PB_MERGERS: Array<PBMergeFunction<SDVXLikes>> = [
	CreatePBMergeFor<SDVXLikes>(
		"largest",
		{ type: "REGULAR", metric: "lamp" },
		"Best Lamp",
		(base, score) => {
			base.scoreData.lamp = score.scoreData.lamp;
		},
	),
];

export const SDVXLIKE_DEFAULT_MERGE_NAME = "Best Score";

export const SDVXLIKE_SCORE_VALIDATORS: Array<ScoreValidator<SDVXLikes>> = [
	(s) => {
		if (s.scoreData.lamp === "PERFECT ULTIMATE CHAIN" && s.scoreData.score !== 10_000_000) {
			return "Cannot have a PERFECT ULTIMATE CHAIN without a perfect score.";
		}
	},
	(s) => {
		const { near, miss } = s.scoreData.judgements;

		if (s.scoreData.lamp === "PERFECT ULTIMATE CHAIN" && (miss ?? 0) + (near ?? 0) > 0) {
			return "Cannot have a PERFECT ULTIMATE CHAIN with any nears or misses.";
		} else if (s.scoreData.lamp === "ULTIMATE CHAIN" && (miss ?? 0) > 0) {
			return "Cannot have an ULTIMATE CHAIN with non-zero miss count.";
		}
	},
	(s) => {
		if (s.scoreData.lamp === "ULTIMATE CHAIN" && s.scoreData.score < 5_000_000) {
			return "Cannot have an ULTIMATE CHAIN with a score less than 5m.";
		}
	},
];

export const SGL_SESSION_CALCS: GPTSessionCalcs<BmsPmsGames> = (arr) => ({
	sieglinde: SessionAvgBest10For("sieglinde")(arr),
});

export const SGL_PROFILE_CALCS: GPTProfileCalcs<BmsPmsGames> = async (game, userID) => ({
	sieglinde: await ProfileAvgBestN("sieglinde", 20)(game, userID),
});

export const SGL_SCORE_CALCS: GPTScoreCalcs<BmsPmsGames> = (scoreData, _derivedData, chart) => {
	const ecValue = chart.data.sglEC ?? 0;
	const hcValue = chart.data.sglHC ?? 0;

	switch (scoreData.lamp) {
		case "FULL COMBO":
		case "EX HARD CLEAR":
		case "HARD CLEAR":
			return { sieglinde: Math.max(hcValue, ecValue) };
		case "CLEAR":
		case "EASY CLEAR":
			return { sieglinde: ecValue };
		default:
			return { sieglinde: 0 };
	}
};

/**
 * Run all of the provided validators on the given score.
 *
 * @returns undefined on success, an array of error messages (strings) on failure.
 */
export function RunValidators<TGame extends V3Game>(
	validators: Array<ScoreValidator<TGame>>,
	score: ScoreDocument<TGame>,
	chart: ChartDocument<TGame>,
) {
	const errs = [];

	for (const validator of validators) {
		const err = validator(score, chart);

		if (err !== undefined) {
			errs.push(err);
		}
	}

	if (errs.length === 0) {
		return;
	}

	return errs;
}
