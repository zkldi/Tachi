import type { ScoreData } from "tachi-common";

import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { describe, expect, it } from "vitest";

import { CreatePBMergeFor } from "./pb-merge";

describe("CreatePBMergeFor (Postgres)", () => {
	let counter = 0;

	async function seedIidxChartAndScores(
		userId: number,
		scores: Array<{
			highlight?: boolean;
			mongo: ScoreData<"iidx-sp">;
			timeAchievedMs: number;
		}>,
	): Promise<{ chartId: string; chartLegacyId: string }> {
		const n = ++counter;
		const songId = `song-pbm-${n}`;
		const chartId = `chart-pbm-${n}`;
		const chartLegacyId = `legacy-chart-${n}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 500_000 + n,
				game_group: "iidx",
				title: "S",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartLegacyId,
				game: "iidx-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		for (const s of scores) {
			const scoreId = `score-pbm-${n}-${s.timeAchievedMs}`;
			const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
				...s.mongo,
				judgements: s.mongo.judgements ?? {},
			});

			await DB.insertInto("score")
				.values({
					id: scoreId,
					user_id: userId,
					chart_id: chartId,
					game: "iidx-sp",
					session_id: null,
					import_id: null,
					data: JSON.stringify(data),
					derived_data: JSON.stringify(derived),
					judgements: JSON.stringify(judgements),
					calculated_data: JSON.stringify({}),
					meta: JSON.stringify({}),
					time_achieved: UnixMillisecondsToISO8601(s.timeAchievedMs),
					time_added: UnixMillisecondsToISO8601(s.timeAchievedMs),
					highlight: s.highlight ?? false,
					comment: null,
				})
				.execute();
		}

		return { chartLegacyId, chartId };
	}

	const basePb = () =>
		({
			composedFrom: [{ name: "Primary", scoreID: "x" }],
			userID: 0,
			chartID: "",
			game: "iidx-sp",
			songID: 0,
			scoreData: {} as any,
			calculatedData: {},
			highlight: false,
			isPrimary: true,
			timeAchieved: null,
		}) as any;

	it("returns null when no scores match", async () => {
		const { id: userId } = await seedUser();
		const merge = CreatePBMergeFor<"iidx-sp">(
			"largest",
			{ metric: "score", type: "REGULAR" },
			"Best Score",
			() => {},
		);
		const result = await merge(userId, "nonexistent-chart", null, basePb());
		expect(result).toBeNull();
	});

	it("picks largest score", async () => {
		const { id: userId } = await seedUser();
		const { chartId } = await seedIidxChartAndScores(userId, [
			{
				timeAchievedMs: 1_000_000,
				mongo: {
					grade: "F",
					lamp: "FAILED",
					percent: 0,
					score: 100,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
			{
				timeAchievedMs: 2_000_000,
				mongo: {
					grade: "F",
					lamp: "FAILED",
					percent: 0,
					score: 999,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
		]);

		const merge = CreatePBMergeFor<"iidx-sp">(
			"largest",
			{ metric: "score", type: "REGULAR" },
			"Best Score",
			() => {},
		);
		const pb = basePb();
		const result = await merge(userId, chartId, null, pb);

		expect(result?.scoreID).toMatch(/^score-pbm-/u);
		const picked = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", result!.scoreID)
			.executeTakeFirst();
		expect(picked?.id).toContain(String(2_000_000));
	});

	it("breaks ties by oldest timeAchieved", async () => {
		const { id: userId } = await seedUser();
		const { chartId } = await seedIidxChartAndScores(userId, [
			{
				timeAchievedMs: 5_000_000,
				mongo: {
					grade: "A",
					lamp: "CLEAR",
					percent: 50,
					score: 500,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
			{
				timeAchievedMs: 1_000_000,
				mongo: {
					grade: "A",
					lamp: "CLEAR",
					percent: 50,
					score: 500,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
		]);

		const merge = CreatePBMergeFor<"iidx-sp">(
			"largest",
			{ metric: "score", type: "REGULAR" },
			"Best Score",
			() => {},
		);
		const result = await merge(userId, chartId, null, basePb());

		expect(result?.scoreID).toContain("1000000");
	});

	it("respects asOfTimestamp", async () => {
		const { id: userId } = await seedUser();
		const { chartId } = await seedIidxChartAndScores(userId, [
			{
				timeAchievedMs: 100,
				mongo: {
					grade: "F",
					lamp: "FAILED",
					percent: 0,
					score: 2000,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
			{
				timeAchievedMs: 5000,
				mongo: {
					grade: "F",
					lamp: "FAILED",
					percent: 0,
					score: 9000,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
		]);

		const merge = CreatePBMergeFor<"iidx-sp">(
			"largest",
			{ metric: "score", type: "REGULAR" },
			"Best Score",
			() => {},
		);
		const result = await merge(userId, chartId, 3000, basePb());

		expect(result?.scoreID).toContain("100");
	});

	it("picks smallest optional.bp", async () => {
		const { id: userId } = await seedUser();
		const { chartId } = await seedIidxChartAndScores(userId, [
			{
				timeAchievedMs: 10_000,
				mongo: {
					grade: "A",
					lamp: "CLEAR",
					percent: 50,
					score: 400,
					optional: { bp: 12 },
				} as ScoreData<"iidx-sp">,
			},
			{
				timeAchievedMs: 20_000,
				mongo: {
					grade: "A",
					lamp: "CLEAR",
					percent: 50,
					score: 400,
					optional: { bp: 3 },
				} as ScoreData<"iidx-sp">,
			},
		]);

		const merge = CreatePBMergeFor<"iidx-sp">(
			"smallest",
			{ metric: "bp", type: "REGULAR" },
			"Lowest BP",
			() => {},
		);
		const result = await merge(userId, chartId, null, basePb());

		expect(result?.scoreID).toContain("20000");
	});

	it("merges highlight from chosen score", async () => {
		const { id: userId } = await seedUser();
		const { chartId } = await seedIidxChartAndScores(userId, [
			{
				timeAchievedMs: 1,
				highlight: true,
				mongo: {
					grade: "F",
					lamp: "FAILED",
					percent: 0,
					score: 50,
					optional: {},
				} as ScoreData<"iidx-sp">,
			},
		]);

		const merge = CreatePBMergeFor<"iidx-sp">(
			"largest",
			{ metric: "score", type: "REGULAR" },
			"Best Score",
			() => {},
		);
		const pb = basePb();
		pb.highlight = false;
		await merge(userId, chartId, null, pb);
		expect(pb.highlight).toBe(true);
	});
});
