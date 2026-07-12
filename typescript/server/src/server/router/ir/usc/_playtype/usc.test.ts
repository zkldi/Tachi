import type { PBScoreDocument } from "tachi-common";

import { seedUser } from "#actions/test-utils/api-tokens";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingUSCChart, TestingUSCSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import { TachiScoreToServerScore } from "./usc";

const mockScorePB = {
	chartID: "USC_CHART_ID",
	calculatedData: {
		VF6: 0,
	},
	composedFrom: [
		{ name: "Best Score", scoreID: "USC_EXAMPLE_SCORE_PB_ID" },
		{ name: "Best Lamp", scoreID: "USC_EXAMPLE_LAMP_PB_ID" },
	],
	game: "usc-controller",
	highlight: false,
	isPrimary: true,
	rankingData: {
		outOf: 2,
		rank: 1,
		rivalRank: null,
	},
	scoreData: {
		grade: "AAA+",
		judgements: {
			critical: 100,
			miss: 15,
		},
		enumIndexes: {
			grade: 7,
			lamp: 3,
		},
		lamp: "EXCESSIVE CLEAR",
		score: 9_500_000,
		optional: {
			enumIndexes: {},
		},
	},
	songID: "S19d35e0e4396423789f",
	timeAchieved: null,
	userID: 1,
} satisfies PBScoreDocument<"usc-controller">;

async function seedUscControllerChart() {
	const chart = dmf(TestingUSCChart, { game: "usc-controller" } as never);

	await DB.insertInto("song")
		.values({
			id: TestingUSCSong.id,
			legacy_id: 1,
			game_group: "usc",
			title: TestingUSCSong.title,
			artist: TestingUSCSong.artist,
			search_terms: TestingUSCSong.searchTerms,
			alt_titles: TestingUSCSong.altTitles,
			data: TestingUSCSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "usc-controller",
			song_id: TestingUSCSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertReferencedScore(opts: { scoreId: string; timeMs: number }) {
	const { data, derived, judgements } = mongoScoreDataToPg(
		"usc-controller",
		mockScorePB.scoreData,
	);
	const t = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: 1,
			chart_id: "USC_CHART_ID",
			game: "usc-controller",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({
				noteMod: "MIRROR",
				gaugeMod: "HARD",
			}),
			time_achieved: t,
			time_added: t,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("TachiScoreToServerScore (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "usc-helpers@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUscControllerChart();
	});

	it("converts a PB + score row to USC ServerScore", async () => {
		await insertReferencedScore({ scoreId: "USC_EXAMPLE_SCORE_PB_ID", timeMs: 0 });

		const res = await TachiScoreToServerScore(mockScorePB);

		expect(res).toEqual({
			score: 9_500_000,
			timestamp: 0,
			crit: 100,
			near: 0,
			error: 15,
			ranking: 1,
			lamp: 3,
			username: "test_zkldi",
			noteMod: "MIRROR",
			gaugeMod: "HARD",
		});
	});

	it("uses Unix seconds for timestamp when timeAchieved is set", async () => {
		await insertReferencedScore({ scoreId: "USC_EXAMPLE_SCORE_PB_ID", timeMs: 0 });

		const res = await TachiScoreToServerScore(
			deepmerge(mockScorePB, { timeAchieved: 1_621_844_762_995 }) as typeof mockScorePB,
		);

		expect(res.timestamp).toBe(1_621_844_762);
	});

	it("throws when the PB user has no account", async () => {
		await expect(
			TachiScoreToServerScore(
				deepmerge(mockScorePB, { userID: 2 }) as PBScoreDocument<"usc-controller">,
			),
		).rejects.toThrow(/User 2 from PB on chart/u);
	});

	it("throws when the referenced score row is missing", async () => {
		await expect(TachiScoreToServerScore(mockScorePB)).rejects.toThrow(
			/Score USC_EXAMPLE_SCORE_PB_ID does not exist/u,
		);
	});
});
