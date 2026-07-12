import type { GoalDocument, GoalSubscriptionDocument } from "tachi-common";

import { SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { ToGoalSubscriptionDocument } from "#lib/db-formats/target-documents";
import { log } from "#lib/log/log";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import {
	HC511Goal,
	HC511UserGoal,
	Testing511Song,
	Testing511SPA,
	TestingIIDXSPScorePB,
} from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { describe, expect, it } from "vitest";

import { ProcessGoal, UpdateGoalsForUser } from "./goals";

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

async function insertPbFromIidxDoc(userId: number, doc: typeof TestingIIDXSPScorePB) {
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

describe("UpdateGoalsForUser", () => {
	const baseGoalDocument: GoalDocument = {
		charts: {
			type: "single",
			data: Testing511SPA.chartID,
		},
		game: "iidx-sp",
		goalID: "FAKE_GOAL_ID",
		name: "get > 1 ex score on some other folder.",
		criteria: {
			mode: "single",
			value: 1,
			key: "score",
		},
	};

	const baseGoalSubscriptionDocument: GoalSubscriptionDocument = {
		achieved: false,
		wasInstantlyAchieved: false,
		game: "iidx-sp",
		goalID: "FAKE_GOAL_ID",
		lastInteraction: null,
		outOf: 1,
		outOfHuman: "1",
		progress: 0,
		progressHuman: "0",
		timeAchieved: null,
		wasAssignedStandalone: false,
		userID: 1,
	};

	it("updates goals when the user achieves the criteria", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const sub = dmf(baseGoalSubscriptionDocument, { userID: userId });

		await DB.insertInto("goal")
			.values({
				id: baseGoalDocument.goalID,
				game: baseGoalDocument.game,
				name: baseGoalDocument.name,
				charts: baseGoalDocument.charts,
				criteria: baseGoalDocument.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: baseGoalDocument.goalID,
				user_id: userId,
				last_interaction: null,
				progress: 0,
				progress_human: "0",
				out_of: 1,
				out_of_human: "1",
				achieved: false,
				time_achieved: null,
				was_instantly_achieved: false,
				was_assigned_standalone: false,
			})
			.execute();

		await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);

		const ugMap = new Map([[baseGoalDocument.goalID, sub]]);

		const res = await UpdateGoalsForUser([baseGoalDocument], ugMap, userId, log);

		expect(res).toEqual([
			{
				goalID: "FAKE_GOAL_ID",
				old: {
					progress: 0,
					progressHuman: "0",
					outOf: 1,
					outOfHuman: "1",
					achieved: false,
				},
				new: {
					progress: 1479,
					progressHuman: "1479",
					outOf: 1,
					outOfHuman: "1",
					achieved: true,
				},
			},
		]);

		const r = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_id", "=", "FAKE_GOAL_ID")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(r).toMatchObject({
			progress: 1479,
			progress_human: "1479",
			out_of: 1,
			out_of_human: "1",
			achieved: true,
		});
	});

	it("updates goals when the user has not achieved the criteria", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		const goal = dmf(baseGoalDocument, { criteria: { value: 2 } });
		const goalSub = dmf(baseGoalSubscriptionDocument, {
			userID: userId,
			outOf: 2,
			outOfHuman: "2",
		});

		await DB.insertInto("goal")
			.values({
				id: goal.goalID,
				game: goal.game,
				name: goal.name,
				charts: goal.charts,
				criteria: goal.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: goal.goalID,
				user_id: userId,
				last_interaction: null,
				progress: 0,
				progress_human: "0",
				out_of: 2,
				out_of_human: "2",
				achieved: false,
				time_achieved: null,
				was_instantly_achieved: false,
				was_assigned_standalone: false,
			})
			.execute();

		await insertPbFromIidxDoc(
			userId,
			dmf(TestingIIDXSPScorePB, {
				scoreData: { ...TestingIIDXSPScorePB.scoreData, score: 1 },
			}),
		);

		const ugMap = new Map([[goal.goalID, goalSub]]);

		const res = await UpdateGoalsForUser([goal], ugMap, userId, log);

		expect(res).toEqual([
			{
				goalID: "FAKE_GOAL_ID",
				old: {
					progress: 0,
					progressHuman: "0",
					outOf: 2,
					outOfHuman: "2",
					achieved: false,
				},
				new: {
					progress: 1,
					progressHuman: "1",
					outOf: 2,
					outOfHuman: "2",
					achieved: false,
				},
			},
		]);

		const r = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_id", "=", "FAKE_GOAL_ID")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(r).toMatchObject({
			progress: 1,
			progress_human: "1",
			out_of: 2,
			out_of_human: "2",
			achieved: false,
		});
	});

	it("returns [] when there is nothing to update", async () => {
		const { id: userId } = await seedUser();
		const res = await UpdateGoalsForUser([], new Map(), userId, log);
		expect(res).toEqual([]);
	});

	it("skips goals when the user has no matching subscription", async () => {
		const { id: userId } = await seedUser();
		const res = await UpdateGoalsForUser([baseGoalDocument], new Map(), userId, log);
		expect(res).toEqual([]);
	});

	it("skips invalid goal chart types", async () => {
		const { id: userId } = await seedUser();
		const badGoal = {
			...baseGoalDocument,
			charts: { type: "INVALID", data: Testing511SPA.chartID },
		} as unknown as GoalDocument;

		const sub = dmf(baseGoalSubscriptionDocument, { userID: userId });

		const res = await UpdateGoalsForUser(
			[badGoal],
			new Map([[baseGoalDocument.goalID, sub]]),
			userId,
			log,
		);

		expect(res).toEqual([]);
	});
});

describe("ProcessGoal", () => {
	it("returns import info when the score changes goal progress", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		await DB.insertInto("goal")
			.values({
				id: HC511Goal.goalID,
				game: HC511Goal.game,
				name: HC511Goal.name,
				charts: HC511Goal.charts,
				criteria: HC511Goal.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: HC511Goal.goalID,
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

		await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);

		const sub = dmf(HC511UserGoal, { userID: userId });
		const res = await ProcessGoal(HC511Goal, sub, userId, log);

		expect(res).toBeDefined();
		expect(res?.import).toStrictEqual({
			goalID: "mock_goalID",
			old: {
				progress: null,
				progressHuman: "NO DATA",
				outOf: 5,
				outOfHuman: "HARD CLEAR",
				achieved: false,
			},
			new: {
				progress: 6,
				progressHuman: "EX HARD CLEAR (BP: 2)",
				outOf: 5,
				outOfHuman: "HARD CLEAR",
				achieved: true,
			},
		});
	});

	it("clears wasInstantlyAchieved when the goal becomes unachieved", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		await DB.insertInto("goal")
			.values({
				id: HC511Goal.goalID,
				game: HC511Goal.game,
				name: HC511Goal.name,
				charts: HC511Goal.charts,
				criteria: HC511Goal.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: HC511Goal.goalID,
				user_id: userId,
				last_interaction: null,
				progress: 6,
				progress_human: "EX HARD CLEAR",
				out_of: 5,
				out_of_human: "HARD CLEAR",
				achieved: true,
				time_achieved: UnixMillisecondsToISO8601(1000),
				was_instantly_achieved: true,
				was_assigned_standalone: false,
			})
			.execute();

		const achievedGoalSub: GoalSubscriptionDocument = {
			achieved: true,
			game: "iidx-sp",
			goalID: "mock_goalID",
			lastInteraction: null,
			outOf: 5,
			outOfHuman: "HARD CLEAR",
			progress: 6,
			progressHuman: "EX HARD CLEAR",
			timeAchieved: 1000,
			wasInstantlyAchieved: true,
			wasAssignedStandalone: false,
			userID: userId,
		};

		const res = await ProcessGoal(HC511Goal, achievedGoalSub, userId, log);

		expect(res).toBeDefined();
		expect(res?.import).toMatchObject({
			goalID: "mock_goalID",
			old: {
				progress: 6,
				outOf: 5,
				achieved: true,
			},
			new: {
				progress: null,
				outOf: 5,
				achieved: false,
			},
		});
		expect(res?.pgUpdate?.set.was_instantly_achieved).toBe(false);
	});

	it("returns undefined when there is no personal best", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		await DB.insertInto("goal")
			.values({
				id: HC511Goal.goalID,
				game: HC511Goal.game,
				name: HC511Goal.name,
				charts: HC511Goal.charts,
				criteria: HC511Goal.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: HC511Goal.goalID,
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

		const sub = dmf(HC511UserGoal, { userID: userId });
		const res = await ProcessGoal(HC511Goal, sub, userId, log);

		expect(res).toBeUndefined();
	});

	it("returns undefined when progress is already up to date", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		await DB.insertInto("goal")
			.values({
				id: HC511Goal.goalID,
				game: HC511Goal.game,
				name: HC511Goal.name,
				charts: HC511Goal.charts,
				criteria: HC511Goal.criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: HC511Goal.goalID,
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

		await insertPbFromIidxDoc(userId, TestingIIDXSPScorePB);

		const sub = dmf(HC511UserGoal, { userID: userId });
		const firstUpdate = await ProcessGoal(HC511Goal, sub, userId, log);
		expect(firstUpdate).toBeDefined();

		await DB.updateTable("goal_sub")
			.set(firstUpdate!.pgUpdate.set)
			.where("goal_id", "=", firstUpdate!.pgUpdate.goalId)
			.where("user_id", "=", firstUpdate!.pgUpdate.userId)
			.execute();

		const row = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.goal_id", "=", HC511Goal.goalID)
			.where("goal_sub.user_id", "=", userId)
			.executeTakeFirstOrThrow();

		const goalSub = ToGoalSubscriptionDocument(row);
		const secondUpdate = await ProcessGoal(HC511Goal, goalSub, userId, log);

		expect(secondUpdate).toBeUndefined();
	});
});
