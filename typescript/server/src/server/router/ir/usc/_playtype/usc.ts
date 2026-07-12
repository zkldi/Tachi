import type {
	ChartDocument,
	GamesForGroup,
	integer,
	PBScoreDocument,
	ScoreDocument,
} from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import { USCIR_ADJACENT_SCORE_N } from "#lib/constants/usc-ir";
import {
	GetPBOnChart,
	GetServerRecordOnChart,
	LoadPbsAdjacentByChartRank,
} from "#lib/db-formats/pb";
import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { log } from "#lib/log/log";
import { MStoS } from "#utils/misc";
import { GetUsernameFromUserID } from "#utils/user";

import type { USCServerScore } from "./types";

export const TACHI_LAMP_TO_USC: Record<
	GetEnumValue<GamesForGroup["usc"], "lamp">,
	USCServerScore["lamp"]
> = {
	// we don't do NO PLAY, so its not handled.
	FAILED: 1,
	CLEAR: 2,
	"EXCESSIVE CLEAR": 3,
	"ULTIMATE CHAIN": 4,
	"PERFECT ULTIMATE CHAIN": 5,
};

/**
 * Converts a Tachi Score to the ServerScoreDocument
 * as specified in the USCIR spec. This function silently
 * returns sentinel values in the case that certain
 * fields are null.
 */
export async function TachiScoreToServerScore(
	tachiScore: PBScoreDocument<GamesForGroup["usc"]>,
): Promise<USCServerScore> {
	let username: string;
	try {
		username = await GetUsernameFromUserID(tachiScore.userID);
	} catch {
		log.error(
			`User ${tachiScore.userID} from PB on chart ${tachiScore.chartID} has no user document?`,
		);
		throw new Error(
			`User ${tachiScore.userID} from PB on chart ${tachiScore.chartID} has no user document?`,
		);
	}

	const firstScoreID = tachiScore.composedFrom[0].scoreID;

	const scorePB = (await LoadScoreDocumentById(firstScoreID)) as
		| ScoreDocument<GamesForGroup["usc"]>
		| undefined;

	if (!scorePB) {
		log.error(
			`Score ${firstScoreID} does not exist, but is referenced in ${tachiScore.userID}'s PBDoc on ${tachiScore.chartID}?`,
		);

		throw new Error(
			`Score ${firstScoreID} does not exist, but is referenced in ${tachiScore.userID}'s PBDoc on ${tachiScore.chartID}?`,
		);
	}

	return {
		score: tachiScore.scoreData.score,
		timestamp: MStoS(tachiScore.timeAchieved ?? 0),
		crit: tachiScore.scoreData.judgements.critical ?? 0,
		near: tachiScore.scoreData.judgements.near ?? 0,
		error: tachiScore.scoreData.judgements.miss ?? 0,
		ranking: tachiScore.rankingData.rank,
		lamp: TACHI_LAMP_TO_USC[tachiScore.scoreData.lamp],
		username,
		noteMod: scorePB.scoreMeta.noteMod ?? "NORMAL",
		gaugeMod: scorePB.scoreMeta.gaugeMod ?? "NORMAL",
	};
}

export async function CreatePOSTScoresResponseBody(
	userID: integer,
	chartDoc: ChartDocument<GamesForGroup["usc"]>,
	scoreID: string,
): Promise<POSTScoresResponseBody> {
	const scorePB = (await GetPBOnChart(userID, chartDoc.chartID)) as PBScoreDocument<
		GamesForGroup["usc"]
	> | null;

	if (!scorePB) {
		log.error(
			{
				chartDoc,
				scoreID,
			},
			`Score was imported for chart, but no ScorePB was available on this chart?`,
		);
		throw new Error(
			`Score was imported for chart, but no ScorePB was available on this chart?`,
		);
	}

	const ktServerRecord = (await GetServerRecordOnChart(chartDoc.chartID)) as PBScoreDocument<
		GamesForGroup["usc"]
	> | null;

	// this is impossible to trigger without making a race-condition.
	/* istanbul ignore next */
	if (!ktServerRecord) {
		log.error(
			{
				chartDoc,
				scoreID,
			},
			`Score was imported for chart, but no Server Record was available on this chart?`,
		);
		throw new Error(
			`Score was imported for chart, but no Server Record was available on this chart?`,
		);
	}

	const usersRanking = scorePB.rankingData.rank;

	// This returns immediately ranked higher
	// than the current user.

	const adjAbove = (await LoadPbsAdjacentByChartRank(
		chartDoc.chartID,
		usersRanking,
		"above",
		USCIR_ADJACENT_SCORE_N,
	)) as Array<PBScoreDocument<GamesForGroup["usc"]>>;

	// The specification enforces that we return them in
	// ascending order, though, so we reverse this after
	// the query.
	adjAbove.reverse();

	// if the users ranking implies that the above query
	// returned the server record (i.e. they are ranked
	// between #1 and #1 + N)
	// delete the server record from adjAbove.
	if (usersRanking - USCIR_ADJACENT_SCORE_N <= 1) {
		adjAbove.shift();
	}

	// Similar to above, this returns the N most immediate
	// scores below the given user.
	const adjBelow = (await LoadPbsAdjacentByChartRank(
		chartDoc.chartID,
		usersRanking,
		"below",
		USCIR_ADJACENT_SCORE_N,
	)) as Array<PBScoreDocument<GamesForGroup["usc"]>>;

	const [score, serverRecord, adjacentAbove, adjacentBelow] = await Promise.all([
		TachiScoreToServerScore(scorePB),
		TachiScoreToServerScore(ktServerRecord),
		Promise.all(adjAbove.map(TachiScoreToServerScore)),
		Promise.all(adjBelow.map(TachiScoreToServerScore)),
	]);

	const originalScore = (await LoadScoreDocumentById(scoreID)) as
		| ScoreDocument<GamesForGroup["usc"]>
		| undefined;

	if (!originalScore) {
		log.error(
			`Score with ID ${scoreID} is not in the database, but was claimed to be inserted?`,
		);
		throw new Error(
			`Score with ID ${scoreID} is not in the database, but was claimed to be inserted?`,
		);
	}

	return {
		score,
		serverRecord,
		isServerRecord: scorePB.userID === ktServerRecord.userID,
		// it's a pb if the score is equal to what the user has as their best.
		// lamps notwithstanding.
		isPB: scorePB.scoreData.score === score.score,
		sendReplay: originalScore.scoreID,
		adjacentAbove,
		adjacentBelow,
	};
}

export interface POSTScoresResponseBody {
	score: USCServerScore;
	serverRecord: USCServerScore;
	adjacentAbove: Array<USCServerScore>;
	adjacentBelow: Array<USCServerScore>;
	isPB: boolean;
	isServerRecord: boolean;
	sendReplay: string;
}
