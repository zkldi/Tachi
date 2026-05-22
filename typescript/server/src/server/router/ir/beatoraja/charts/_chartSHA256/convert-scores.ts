import type { BMSGames, integer, PBScoreDocument } from "tachi-common";

const LAMP_TO_BEATORAJA = [0, 1, 3, 4, 5, 6, 7, 8] as const;

const RAN_INDEXES = {
	NONRAN: 0,
	MIRROR: 1,
	RANDOM: 2,
	"R-RANDOM": 3,
	"S-RANDOM": 4,
} as const;

type BeatorajaScoreMeta = {
	inputDevice?: string | null;
	random?: keyof typeof RAN_INDEXES | [keyof typeof RAN_INDEXES, keyof typeof RAN_INDEXES] | null;
};

type BeatorajaJudgements = `${"e" | "l"}${"bd" | "gd" | "gr" | "ms" | "pg" | "pr"}`;

type BeatorajaScoreJudgements = {
	[K in BeatorajaJudgements]: integer;
};

interface BeatorajaPartialScoreFormat {
	sha256: string;
	player: string;
	playcount: integer;
	clear: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	date: number;
	deviceType: string | null;
	gauge: number;
	random: 0 | 1 | 2 | 3 | 4 | null;
	passnotes: integer;
	minbp: integer;
	notes: integer;
	maxcombo: integer | null;
}

export type BeatorajaIRScoreFormat = BeatorajaPartialScoreFormat & BeatorajaScoreJudgements;

/**
 * Converts various data from Tachi to the beatoraja format.
 * @param pbScore - The users PB Score document for this chart.
 * @param sha256 - The SHA256 for this chart.
 * @param username - The users name. Beatoraja uses the special value "" to indicate the user is the current player.
 * @param notecount - The notecount for this chart.
 * @param playcount - The total times this player has played this chart.
 * @param inputDevice - The input device this user used.
 * @param random - What random modifier was used.
 * @returns A Beatoraja Score Document.
 */
export function TachiScoreDataToBeatorajaFormat(
	pbScore: PBScoreDocument<BMSGames>,
	sha256: string,
	username: string,
	notecount: integer,
	playcount: integer,
	scoreMeta: BeatorajaScoreMeta = {},
) {
	const scoreData = pbScore.scoreData;
	const random = Array.isArray(scoreMeta.random) ? null : scoreMeta.random;

	const beatorajaScore: BeatorajaPartialScoreFormat = {
		sha256,
		player: username,
		playcount,
		clear: LAMP_TO_BEATORAJA[scoreData.enumIndexes.lamp] ?? 0,
		date: pbScore.timeAchieved ?? 0,
		maxcombo: scoreData.optional.maxCombo ?? 0,
		gauge: scoreData.optional.gauge ?? 0,

		deviceType: scoreMeta.inputDevice ?? null,
		random: random === undefined || random === null ? null : RAN_INDEXES[random],

		minbp: scoreData.optional.bp ?? 0,
		passnotes: 0,
		notes: notecount,
	};

	const judgements: Partial<BeatorajaScoreJudgements> = {};

	// Not everything exports these properties. If they're not there, they should default to 0.
	// For cases like LR2/manual - this will just result in a set of 0s.
	for (const key of [
		"egd",
		"lgd",
		"ebd",
		"lbd",
		"epr",
		"lpr",
	] satisfies Array<BeatorajaJudgements>) {
		judgements[key] = scoreData.optional[key] ?? 0;
	}

	judgements.ems = 0;
	judgements.lms = 0;

	// // If we have no epg/egr data, we can't calculate EX score on the beatoraja client.
	// // We have to fake some data for LR2 scores/other scores.
	// if (!judgements.epg && !judgements.lpg && !judgements.egr && !judgements.lgr) {

	// As a temporary measure, we are going to always enable this hack.
	// It seems like there are a lot of old CN scores that have completely
	// invalid values for these judgement fields.
	// truly fun.
	judgements.epg = Math.floor(pbScore.scoreData.score / 2);
	judgements.egr = pbScore.scoreData.score % 2;
	judgements.lpg = 0;
	judgements.lgr = 0;

	// }

	return { ...beatorajaScore, ...judgements };
}
