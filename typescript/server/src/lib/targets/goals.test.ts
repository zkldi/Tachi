import { log } from "#lib/log/log";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkFakePBIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import {
	HC511Goal,
	Testing511Song,
	Testing511SPA,
	TestingIIDXFolderSP10,
	TestingIIDXSPScorePB,
} from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { randomBytes } from "node:crypto";
import { type GoalDocument, IIDX_GRADES, type PBScoreDocument, type ScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

import {
	EvaluateGoalForUser,
	GetRelevantFolderGoals,
	GetRelevantGoals,
	HumaniseGoalProgress,
} from "./goals";

async function seedIidx511Chart() {
	await DB.insertInto("song")
		.values({
			id: Testing511Song.id,
			legacy_id: 1,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: Testing511SPA.difficulty,
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();
}

async function seedExtraIidxCharts() {
	await DB.insertInto("song")
		.values({
			id: "s-not",
			legacy_id: 123,
			game_group: "iidx",
			title: "Other",
			artist: "X",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: "not_sp10",
			legacy_id: "not_sp10",
			game: "iidx-sp",
			song_id: "s-not",
			difficulty: "ANOTHER",
			level: "9",
			level_num: 9,
			is_primary: true,
			versions: [],
			data: { inGameID: 1, notecount: 100 },
		})
		.execute();

	await DB.insertInto("song")
		.values({
			id: "s-oth",
			legacy_id: 124,
			game_group: "iidx",
			title: "Other 10",
			artist: "Y",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: "other_sp10",
			legacy_id: "other_sp10",
			game: "iidx-sp",
			song_id: "s-oth",
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: [],
			data: { inGameID: 2, notecount: 100 },
		})
		.execute();
}

async function seedSecondChartForMulti(fakeOtherChartId: string) {
	await DB.insertInto("song")
		.values({
			id: "s-fake-other",
			legacy_id: 999,
			game_group: "iidx",
			title: "Fake",
			artist: "Z",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: fakeOtherChartId,
			legacy_id: fakeOtherChartId,
			game: "iidx-sp",
			song_id: "s-fake-other",
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: [],
			data: { inGameID: 3, notecount: 100 },
		})
		.execute();
}

async function insertPbFromIidxDoc(userId: number, doc: PBScoreDocument<"iidx-sp">) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
		...doc.scoreData,
		judgements: doc.scoreData.judgements,
	});

	await DB.insertInto("pb")
		.values({
			user_id: userId,
			chart_id: doc.chartID,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData),
			ranking_value: doc.scoreData.score,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: doc.highlight,
			time_achieved:
				doc.timeAchieved !== null ? UnixMillisecondsToISO8601(doc.timeAchieved) : null,
		})
		.execute();
}

async function rewritePbScoreData(userId: number, chartId: string, sd: ScoreData<"iidx-sp">) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", sd);

	await DB.updateTable("pb")
		.set({
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			ranking_value: sd.score,
		})
		.where("user_id", "=", userId)
		.where("chart_id", "=", chartId)
		.execute();
}

describe("EvaluateGoalForUser", () => {
	describe("single-chart goals", () => {
		it("evaluates success when the user meets the lamp threshold", async () => {
			await seedIidx511Chart();
			const { id: userId } = await seedUser();
			await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);

			const res = await EvaluateGoalForUser(HC511Goal, userId, log);

			expect(res).toStrictEqual({
				achieved: true,
				outOf: 5,
				progress: 6,
				outOfHuman: "HARD CLEAR",
				progressHuman: "EX HARD CLEAR (BP: 2)",
			});
		});

		it("evaluates failure when the user is below the lamp threshold", async () => {
			await seedIidx511Chart();
			const { id: userId } = await seedUser();
			await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);
			await rewritePbScoreData(userId, Testing511SPA.chartID, {
				...TestingIIDXSPScorePB.scoreData,
				lamp: "CLEAR",
				enumIndexes: {
					...TestingIIDXSPScorePB.scoreData.enumIndexes,
					lamp: 4,
				},
			});

			const res = await EvaluateGoalForUser(HC511Goal, userId, log);

			expect(res).toStrictEqual({
				achieved: false,
				outOf: 5,
				progress: 4,
				outOfHuman: "HARD CLEAR",
				progressHuman: "CLEAR (BP: 2)",
			});
		});

		it("returns NO DATA when the user has no PB on the chart", async () => {
			await seedIidx511Chart();
			const { id: userId } = await seedUser();

			const res = await EvaluateGoalForUser(HC511Goal, userId, log);

			expect(res).toStrictEqual({
				achieved: false,
				outOf: 5,
				progress: null,
				outOfHuman: "HARD CLEAR",
				progressHuman: "NO DATA",
			});
		});
	});

	describe("multi-chart goals", () => {
		const fakeOther = "fake_other_chart_id";

		it("succeeds when any listed chart meets the threshold", async () => {
			await seedIidx511Chart();
			await seedSecondChartForMulti(fakeOther);
			const { id: userId } = await seedUser();

			const multiGoal: GoalDocument = dmf(HC511Goal, {
				charts: {
					type: "multi",
					data: [Testing511SPA.chartID, fakeOther],
				},
			});

			await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);
			await insertPbFromIidxDoc(
				userId,
				dmf(TestingIIDXSPScorePB, {
					chartID: fakeOther,
					scoreData: {
						...TestingIIDXSPScorePB.scoreData,
						lamp: "CLEAR",
						enumIndexes: {
							...TestingIIDXSPScorePB.scoreData.enumIndexes,
							lamp: 4,
						},
					},
				}),
			);

			const res = await EvaluateGoalForUser(multiGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: true,
				outOf: 5,
				progress: 6,
				outOfHuman: "HARD CLEAR",
				progressHuman: "EX HARD CLEAR (BP: 2)",
			});
		});

		it("succeeds when a non-primary chart in the set meets the threshold", async () => {
			await seedIidx511Chart();
			await seedSecondChartForMulti(fakeOther);
			const { id: userId } = await seedUser();

			const multiGoal: GoalDocument = dmf(HC511Goal, {
				charts: {
					type: "multi",
					data: [Testing511SPA.chartID, fakeOther],
				},
			});

			await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);
			await insertPbFromIidxDoc(
				userId,
				dmf(TestingIIDXSPScorePB, {
					chartID: fakeOther,
					scoreData: {
						...TestingIIDXSPScorePB.scoreData,
						lamp: "CLEAR",
						enumIndexes: {
							...TestingIIDXSPScorePB.scoreData.enumIndexes,
							lamp: 4,
						},
					},
				}),
			);

			await rewritePbScoreData(userId, Testing511SPA.chartID, {
				...TestingIIDXSPScorePB.scoreData,
				lamp: "CLEAR",
				enumIndexes: {
					...TestingIIDXSPScorePB.scoreData.enumIndexes,
					lamp: 4,
				},
			});
			await rewritePbScoreData(userId, fakeOther, {
				...TestingIIDXSPScorePB.scoreData,
				lamp: "HARD CLEAR",
				enumIndexes: {
					...TestingIIDXSPScorePB.scoreData.enumIndexes,
					lamp: 5,
				},
			});

			const res = await EvaluateGoalForUser(multiGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: true,
				outOf: 5,
				progress: 5,
				outOfHuman: "HARD CLEAR",
				progressHuman: "HARD CLEAR (BP: 2)",
			});
		});

		it("returns NO DATA when none of the charts have scores", async () => {
			await seedIidx511Chart();
			await seedSecondChartForMulti(fakeOther);
			const { id: userId } = await seedUser();

			const multiGoal: GoalDocument = dmf(HC511Goal, {
				charts: {
					type: "multi",
					data: [Testing511SPA.chartID, fakeOther],
				},
			});

			const res = await EvaluateGoalForUser(multiGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: false,
				outOf: 5,
				progress: null,
				outOfHuman: "HARD CLEAR",
				progressHuman: "NO DATA",
			});
		});
	});

	describe("folder goals", () => {
		async function seedFolderGoalFixtures(userId: number) {
			await seedIidx511Chart();
			await seedExtraIidxCharts();

			await DB.insertInto("folder")
				.values({
					id: TestingIIDXFolderSP10.folderID,
					legacy_id: TestingIIDXFolderSP10.folderID,
					game: "iidx-sp",
					inactive: false,
					title: TestingIIDXFolderSP10.title,
					slug: TestingIIDXFolderSP10.slug,
					where: "chart.level_num = 10",
					version_filter: null,
					search_terms: [],
				})
				.execute();

			await DB.insertInto("folder_chart_lookup")
				.values([
					{ folder_id: TestingIIDXFolderSP10.folderID, chart_id: Testing511SPA.chartID },
					{ folder_id: TestingIIDXFolderSP10.folderID, chart_id: "other_sp10" },
				])
				.execute();

			const folderGoal: GoalDocument = dmf(HC511Goal, {
				charts: {
					type: "folder",
					data: TestingIIDXFolderSP10.folderID,
				},
			});

			await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);
			await insertPbFromIidxDoc(
				userId,
				dmf(TestingIIDXSPScorePB, {
					chartID: "other_sp10",
					scoreData: {
						...TestingIIDXSPScorePB.scoreData,
						lamp: "CLEAR",
						enumIndexes: {
							...TestingIIDXSPScorePB.scoreData.enumIndexes,
							lamp: 4,
						},
					},
				}),
			);

			return folderGoal;
		}

		it("succeeds when a folder chart meets the lamp threshold", async () => {
			const { id: userId } = await seedUser();
			const folderGoal = await seedFolderGoalFixtures(userId);

			const res = await EvaluateGoalForUser(folderGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: true,
				outOf: 5,
				progress: 6,
				outOfHuman: "HARD CLEAR",
				progressHuman: "EX HARD CLEAR (BP: 2)",
			});
		});

		it("succeeds when another level-10 folder chart meets the threshold", async () => {
			const { id: userId } = await seedUser();
			const folderGoal = await seedFolderGoalFixtures(userId);

			await rewritePbScoreData(userId, Testing511SPA.chartID, {
				...TestingIIDXSPScorePB.scoreData,
				lamp: "CLEAR",
				enumIndexes: {
					...TestingIIDXSPScorePB.scoreData.enumIndexes,
					lamp: 4,
				},
			});
			await rewritePbScoreData(userId, "other_sp10", {
				...TestingIIDXSPScorePB.scoreData,
				lamp: "HARD CLEAR",
				enumIndexes: {
					...TestingIIDXSPScorePB.scoreData.enumIndexes,
					lamp: 5,
				},
			});

			const res = await EvaluateGoalForUser(folderGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: true,
				outOf: 5,
				progress: 5,
				outOfHuman: "HARD CLEAR",
				progressHuman: "HARD CLEAR (BP: 2)",
			});
		});

		it("returns NO DATA when the user has no PBs on folder charts", async () => {
			const { id: userId } = await seedUser();
			const folderGoal = await seedFolderGoalFixtures(userId);

			await DB.deleteFrom("pb").where("user_id", "=", userId).execute();

			const res = await EvaluateGoalForUser(folderGoal, userId, log);

			expect(res).toStrictEqual({
				achieved: false,
				outOf: 5,
				progress: null,
				outOfHuman: "HARD CLEAR",
				progressHuman: "NO DATA",
			});
		});
	});
});

describe("HumaniseGoalProgress", () => {
	it("prefers AAA- over AA+ for AAA goals", () => {
		expect(
			HumaniseGoalProgress(
				"iidx-sp",
				"grade",
				IIDX_GRADES.AAA,
				mkFakePBIIDXSP({
					scoreData: {
						score: 1865,
						grade: "AA",
						percent: 79.97,
					},
				}),
			),
		).toBe("AAA-208");
	});
});

describe("GetRelevantFolderGoals", () => {
	const fakeFolderGoalDocument: GoalDocument = {
		charts: {
			type: "folder",
			data: TestingIIDXFolderSP10.folderID,
		},
		game: "iidx-sp",
		goalID: "fake_goal_id",
		name: "get > 1 ex score on any level 10.",
		criteria: {
			mode: "single",
			value: 1,
			key: "score",
		},
	};

	const notFolderGoalDocument: GoalDocument = {
		charts: {
			type: "folder",
			data: "some_fake_folder_id",
		},
		game: "iidx-sp",
		goalID: "fake_bad_goal_id",
		name: "get > 1 ex score on some other folder.",
		criteria: {
			mode: "single",
			value: 1,
			key: "score",
		},
	};

	it("returns goals whose folder contains the given chart", async () => {
		await seedIidx511Chart();

		await DB.insertInto("folder")
			.values({
				id: TestingIIDXFolderSP10.folderID,
				legacy_id: TestingIIDXFolderSP10.folderID,
				game: "iidx-sp",
				inactive: false,
				title: TestingIIDXFolderSP10.title,
				slug: TestingIIDXFolderSP10.slug,
				where: "chart.level_num = 10",
				version_filter: null,
				search_terms: [],
			})
			.execute();

		await DB.insertInto("folder_chart_lookup")
			.values({ folder_id: TestingIIDXFolderSP10.folderID, chart_id: Testing511SPA.chartID })
			.execute();

		await DB.insertInto("goal")
			.values([
				{
					id: fakeFolderGoalDocument.goalID,
					game: fakeFolderGoalDocument.game,
					name: fakeFolderGoalDocument.name,
					charts: fakeFolderGoalDocument.charts,
					criteria: fakeFolderGoalDocument.criteria,
				},
				{
					id: notFolderGoalDocument.goalID,
					game: notFolderGoalDocument.game,
					name: notFolderGoalDocument.name,
					charts: notFolderGoalDocument.charts,
					criteria: notFolderGoalDocument.criteria,
				},
			])
			.execute();

		const res = await GetRelevantFolderGoals(
			["fake_goal_id", "fake_bad_goal_id"],
			[Testing511SPA.chartID],
		);

		expect(res).toEqual([fakeFolderGoalDocument]);
	});
});

describe("GetRelevantGoals", () => {
	it("filters subscriptions to goals tied to charts in the session", async () => {
		const { id: userId } = await seedUser();

		const chartIds: Array<string> = [];
		for (let i = 0; i < 25; i++) {
			const cid = `rel-goal-${i}`;
			chartIds.push(cid);
			const songId = `rel-song-${i}`;

			await DB.insertInto("song")
				.values({
					id: songId,
					legacy_id: 10_000 + i,
					game_group: "iidx",
					title: `T${i}`,
					artist: "A",
					search_terms: [],
					alt_titles: [],
					data: { displayVersion: "1", genre: "TEST" },
					fts_document: "",
				})
				.execute();

			await DB.insertInto("chart")
				.values({
					id: cid,
					legacy_id: cid,
					game: "iidx-sp",
					song_id: songId,
					difficulty: "ANOTHER",
					level: "10",
					level_num: 10,
					is_primary: true,
					versions: [],
					data: { inGameID: i, notecount: 100 },
				})
				.execute();
		}

		const goalRows: Array<{ charts: GoalDocument["charts"]; id: string }> = [];

		for (let i = 0; i < 20; i++) {
			const gid = randomBytes(10).toString("hex");
			const cid = chartIds[i]!;
			goalRows.push({
				id: gid,
				charts: { type: "single", data: cid },
			});

			await DB.insertInto("goal")
				.values({
					id: gid,
					game: "iidx-sp",
					name: "get > 1 ex score on some other folder.",
					charts: { type: "single", data: cid },
					criteria: {
						mode: "single",
						value: 1,
						key: "score",
					},
				})
				.execute();

			await DB.insertInto("goal_sub")
				.values({
					goal_id: gid,
					user_id: userId,
					last_interaction: null,
					progress: null,
					progress_human: "NO DATA",
					out_of: 5,
					out_of_human: "HARD CLEAR",
					achieved: false,
					time_achieved: null,
					was_instantly_achieved: false,
					was_assigned_standalone: false,
				})
				.execute();
		}

		const ourCharts = [...chartIds.slice(0, 5), ...chartIds.slice(20, 25)];
		const chartIDSet = new Set(ourCharts);

		const res = await GetRelevantGoals("iidx-sp", userId, chartIDSet, log);

		expect(res.goals.length).toBe(5);
		expect(res.goalSubsMap.size).toBe(5);
	});
});
