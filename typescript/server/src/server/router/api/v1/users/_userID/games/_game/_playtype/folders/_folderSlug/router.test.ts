import { rebuildFolderChartLookup } from "#lib/folders/rebuild-folder-chart-lookup";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingIIDXSPScore } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import deepmerge from "deepmerge";
import { type ScoreData } from "tachi-common";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

let seedCounter = 0;

async function seedIidxSpProfile(userId: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
		})
		.execute();
}

async function seedFolderWithThreeCharts(opts: { folderId: string; folderLegacy: string }) {
	const n = ++seedCounter;
	const songId = `S_FL_TL_${n}`;
	const chartA = `C_FL_TL_A_${n}`;
	const chartB = `C_FL_TL_B_${n}`;
	const chartC = `C_FL_TL_C_${n}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 91_000 + n,
			game_group: "iidx",
			title: "Folder TL",
			artist: "T",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({}),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values([
			{
				id: chartA,
				legacy_id: chartA,
				game: "iidx-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({}),
			},
			{
				id: chartB,
				legacy_id: chartB,
				game: "iidx-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "HYPER",
				versions: [],
				data: JSON.stringify({}),
			},
			{
				id: chartC,
				legacy_id: chartC,
				game: "iidx-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			},
		])
		.execute();

	const where = `chart.id IN ('${chartA}', '${chartB}', '${chartC}')`;

	await DB.insertInto("folder")
		.values({
			id: opts.folderId,
			legacy_id: opts.folderLegacy,
			game: "iidx-sp",
			inactive: false,
			title: "TL folder",
			slug: opts.folderId,
			where,
			version_filter: null,
			search_terms: [],
		})
		.execute();

	await rebuildFolderChartLookup(DB, { folderId: opts.folderId });

	return { chartA, chartB, chartC };
}

async function insertIidxSpScore(opts: {
	chartId: string;
	id: string;
	scoreData: ScoreData<"iidx-sp">;
	timeAchievedMs: number | null;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", opts.scoreData);
	const now = new Date().toISOString();

	await DB.insertInto("score")
		.values({
			id: opts.id,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(TestingIIDXSPScore.calculatedData),
			meta: JSON.stringify({}),
			time_achieved:
				opts.timeAchievedMs !== null
					? UnixMillisecondsToISO8601(opts.timeAchievedMs)
					: null,
			time_added: now,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/folders/:folderID/timeline", () => {
	it("returns one earliest qualifying score per chart, then sorted by time (null as 0)", async () => {
		const { id: userId } = await seedUser({ username: `folder_tl_${Date.now()}` });
		await seedIidxSpProfile(userId);

		const folderId = `folder_tl_${Date.now()}`;
		const { chartA, chartB, chartC } = await seedFolderWithThreeCharts({
			folderId,
			folderLegacy: `${folderId}_leg`,
		});

		const baseSd = TestingIIDXSPScore.scoreData;

		// Chart A: CLEAR lamp, null time - sorts first in final array (null → 0).
		await insertIidxSpScore({
			id: "tl_s_a",
			userId,
			chartId: chartA,
			scoreData: baseSd,
			timeAchievedMs: null,
		});

		// Chart B: multiple rows meeting lamp >= CLEAR; earliest play time wins (100ms).
		await insertIidxSpScore({
			id: "tl_s_b_500",
			userId,
			chartId: chartB,
			scoreData: baseSd,
			timeAchievedMs: 500,
		});
		await insertIidxSpScore({
			id: "tl_s_b_100",
			userId,
			chartId: chartB,
			scoreData: baseSd,
			timeAchievedMs: 100,
		});
		// EASY CLEAR (index 3) - does not satisfy CLEAR floor (index 4).
		await insertIidxSpScore({
			id: "tl_s_b_easy",
			userId,
			chartId: chartB,
			scoreData: deepmerge(baseSd, {
				lamp: "EASY CLEAR",
				enumIndexes: { lamp: 3, grade: baseSd.enumIndexes?.grade ?? 3 },
			}) as ScoreData<"iidx-sp">,
			timeAchievedMs: 50,
		});
		await insertIidxSpScore({
			id: "tl_s_b_null",
			userId,
			chartId: chartB,
			scoreData: baseSd,
			timeAchievedMs: null,
		});

		// Chart C
		await insertIidxSpScore({
			id: "tl_s_c",
			userId,
			chartId: chartC,
			scoreData: baseSd,
			timeAchievedMs: 200,
		});

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/folders/${folderId}/timeline?criteriaType=lamp&criteriaValue=CLEAR`,
		);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		const ids = res.body.body.scores.map((s: { scoreID: string }) => s.scoreID);
		expect(ids).toEqual(["tl_s_a", "tl_s_b_100", "tl_s_c"]);
	});

	it("returns 400 for invalid criteriaType", async () => {
		const { id: userId } = await seedUser({ username: `folder_tl_bad_${Date.now()}` });
		await seedIidxSpProfile(userId);
		const folderId = `folder_tl_bad_${Date.now()}`;
		await seedFolderWithThreeCharts({ folderId, folderLegacy: `${folderId}_leg` });

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/folders/${folderId}/timeline?criteriaType=not_a_metric&criteriaValue=CLEAR`,
		);

		expect(res.status).toBe(400);
	});

	it("returns 400 for invalid criteriaValue for an ENUM metric", async () => {
		const { id: userId } = await seedUser({ username: `folder_tl_badval_${Date.now()}` });
		await seedIidxSpProfile(userId);
		const folderId = `folder_tl_badval_${Date.now()}`;
		await seedFolderWithThreeCharts({ folderId, folderLegacy: `${folderId}_leg` });

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/folders/${folderId}/timeline?criteriaType=lamp&criteriaValue=nope`,
		);

		expect(res.status).toBe(400);
	});
});

describe("GET /api/v1/users/:userID/games/:game/folders/:folderSlug/evolution", () => {
	it("returns lamp milestones chronologically above minimum relevance", async () => {
		const { id: userId } = await seedUser({ username: `folder_evo_${Date.now()}` });
		await seedIidxSpProfile(userId);

		const folderId = `folder_evo_${Date.now()}`;
		const { chartA } = await seedFolderWithThreeCharts({
			folderId,
			folderLegacy: `${folderId}_leg`,
		});

		const uid = `${Date.now()}_${Math.floor(Math.random() * 100_000)}`;

		async function insScore(scoreId: string, lamp: string, iso: string) {
			const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
				score: 1400,
				lamp,
				percent: 93,
				optional: {},
				judgements: { pgreat: 1, great: 0 },
				grade: "AAA",
			} as ScoreData<"iidx-sp">);

			await DB.insertInto("score")
				.values({
					id: scoreId,
					user_id: userId,
					chart_id: chartA,
					game: "iidx-sp",
					session_id: null,
					import_id: null,
					data: JSON.stringify(data),
					derived_data: JSON.stringify(derived),
					judgements: JSON.stringify(judgements),
					calculated_data: JSON.stringify({}),
					meta: JSON.stringify({}),
					time_achieved: iso,
					time_added: iso,
					highlight: false,
					comment: null,
				})
				.execute();
		}

		await insScore(`sc_${uid}_1`, "FAILED", "2020-01-01T10:00:00.000Z");
		await insScore(`sc_${uid}_2`, "EASY CLEAR", "2020-02-01T10:00:00.000Z");
		await insScore(`sc_${uid}_3`, "HARD CLEAR", "2020-03-01T10:00:00.000Z");

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/folders/${folderId}/evolution`,
		);

		expect(res.status).toBe(200);
		expect(res.body.body.folder.slug).toBe(folderId);

		const { events } = res.body.body;
		const lampEvents = events.filter((e: { metric: string }) => e.metric === "lamp");

		expect(lampEvents.length).toBe(2);
		expect(lampEvents[0].value).toBe("EASY CLEAR");
		expect(lampEvents[1].value).toBe("HARD CLEAR");

		expect(res.body.body.folderChartIDs[folderId]).toContain(chartA);
	});

	it("returns 404 when the folder does not exist", async () => {
		const { id: userId } = await seedUser({ username: `folder_evo_404_${Date.now()}` });
		await seedIidxSpProfile(userId);

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/folders/ghost_folder_xyz/evolution`,
		);

		expect(res.status).toBe(404);
	});
});
