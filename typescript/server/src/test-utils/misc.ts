import type { DeepPartial } from "#utils/types";

import deepmerge from "deepmerge";
import {
	type ChartDocument,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type ImportDocument,
	type integer,
	type NotificationDocument,
	type PBScoreDocument,
	type ScoreData,
	type ScoreDocument,
	type UserDocument,
	type UserGameSettingsDocument,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

import {
	FakeGameSettings,
	FakeImport,
	FakeNotification,
	FakeOtherUser,
	HC511Goal,
	HC511UserGoal,
	TestingDDRSPScorePB,
	TestingIIDXSPScore,
	TestingIIDXSPScorePB,
	TestingJubeatPB,
	TestingSDVXAlbidaChart,
	TestingSDVXPB,
	TestingSDVXScore,
} from "./test-data";

/**
 * Async Generator To Array
 */
export async function agta(ag: AsyncIterable<unknown> | Iterable<unknown>) {
	const a = [];

	for await (const el of ag) {
		a.push(el);
	}

	return a;
}

/**
 * Deep-modify an object. This is a wrapper around deepmerge that returns proper types.
 */
export function dmf<T extends object>(base: T, modifant: DeepPartial<T>): T {
	// @ts-expect-error LOLDEEPMERGETYPES
	return deepmerge(base, modifant, {
		// The new array should replace the former one, instead of joining them together.
		arrayMerge: (_originalArray, newArray) => newArray as Array<unknown>,
	});
}

/**
 * Make a fake user for testing. This automatically sets the username to something
 * unique (to avoid index collisions)
 *
 * @param userID - The userID this fake user should have.
 */
export function mkFakeUser(userID: integer, modifant: DeepPartial<UserDocument> = {}) {
	return dmf(FakeOtherUser, {
		id: userID,
		username: `user${userID}`,
		usernameLowercase: `user${userID}`,
		...modifant,
	});
}

export function mkFakeGameSettings(
	userID: integer,
	game: V3Game,
	modifant: DeepPartial<UserGameSettingsDocument> = {},
) {
	return dmf(FakeGameSettings, {
		userID,
		game,
		...modifant,
	});
}

export function mkFakeImport(modifant: DeepPartial<ImportDocument> = {}) {
	return dmf(FakeImport, modifant);
}

export function mkFakeScoreIIDXSP(modifant: DeepPartial<ScoreDocument<"iidx-sp">> = {}) {
	return dmf(TestingIIDXSPScore, modifant);
}

export function mkFakeScoreSDVX(modifant: DeepPartial<ScoreDocument<"sdvx">> = {}) {
	return dmf(TestingSDVXScore, modifant);
}

export function mkFakePBIIDXSP(modifant: DeepPartial<PBScoreDocument<"iidx-sp">> = {}) {
	return dmf(TestingIIDXSPScorePB, modifant);
}

export function mkFakePBDDRSP(modifant: DeepPartial<PBScoreDocument<"ddr-sp">> = {}) {
	return dmf(TestingDDRSPScorePB, modifant);
}

export function mkFakePBJubeat(modifant: DeepPartial<PBScoreDocument<"jubeat">> = {}) {
	return dmf(TestingJubeatPB, modifant);
}

export function mkFakeNotification(modifant: DeepPartial<NotificationDocument> = {}) {
	return dmf(FakeNotification, modifant);
}

export function mkFakeGoal(modifant: DeepPartial<GoalDocument> = {}) {
	return dmf(HC511Goal, modifant);
}

export function mkFakeGoalSub(modifant: DeepPartial<GoalSubscriptionDocument> = {}) {
	return dmf(HC511UserGoal, modifant);
}

export function mkFakeGameStats(
	userID: integer,
	modifant: DeepPartial<UserGameStats> = {},
): UserGameStats {
	return dmf(
		{
			userID,
			game: "iidx-sp",
			classes: {},
			ratings: {},
		},
		// @ts-expect-error idk lol types
		modifant,
	);
}

export function mkFakeSDVXChart(
	chartID: string,
	modifant: DeepPartial<ChartDocument<"sdvx">> = {},
) {
	return dmf(TestingSDVXAlbidaChart, {
		chartID,
		...modifant,
	});
}

export function mkFakeSDVXPB(modifant: DeepPartial<PBScoreDocument<"sdvx">> = {}) {
	return dmf(TestingSDVXPB, modifant);
}

export function mkMockPB<TGame extends V3Game>(
	game: TGame,
	chart: ChartDocument<TGame>,
	scoreData: ScoreData<TGame>,
): PBScoreDocument<TGame> {
	return {
		userID: 1,
		composedFrom: [{ name: "Best Percent", scoreID: `TEST_${game}_SCORE` }],
		game,
		highlight: false,
		isPrimary: true,
		rankingData: { outOf: 1, rank: 1, rivalRank: null },
		songID: chart.song.id,
		chartID: chart.chartID,
		calculatedData: {},
		scoreData,
		timeAchieved: null,
	};
}

export function mkMockScore<TGame extends V3Game>(
	game: TGame,
	chart: ChartDocument<TGame>,
	scoreData: ScoreData<TGame>,
): ScoreDocument<TGame> {
	return {
		userID: 1,
		game,
		highlight: false,
		isPrimary: true,
		songID: chart.song.id,
		chartID: chart.chartID,
		calculatedData: {},
		scoreData,
		timeAchieved: null,
		comment: null,
		importType: null,
		scoreID: `TEST_${game}_SCORE`,
		sessionID: null,
		scoreMeta: {},
		service: "TESTING",
		timeAdded: 1,
	};
}
