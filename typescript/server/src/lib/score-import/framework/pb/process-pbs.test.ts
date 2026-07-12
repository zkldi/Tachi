import { log } from "#lib/log/log";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ProcessPBs } from "./process-pbs";

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

async function insertIidxScoreRow(opts: {
	chartId: string;
	scoreId: string;
	timeMs: number;
	userId: number;
}) {
	const doc = mkFakeScoreIIDXSP({
		userID: opts.userId,
		scoreID: opts.scoreId,
		chartID: opts.chartId,
		scoreData: TestingIIDXSPScore.scoreData,
		calculatedData: TestingIIDXSPScore.calculatedData,
		timeAchieved: opts.timeMs,
		timeAdded: opts.timeMs,
	});
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData),
			meta: JSON.stringify(doc.scoreMeta),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
			committed: true,
		})
		.execute();
}

async function seedExtraChart(chartId: string, songLegacy: number) {
	const songId = `s-${chartId}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: songLegacy,
			game_group: "iidx",
			title: "T",
			artist: "A",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: chartId,
			game: "iidx-sp",
			song_id: songId,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: [],
			data: Testing511SPA.data,
		})
		.execute();
}

describe("ProcessPBs", () => {
	it("inserts one pb when a score exists on the chart", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		await insertIidxScoreRow({
			userId,
			scoreId: "pb-one",
			chartId: Testing511SPA.chartID,
			timeMs: 1000,
		});

		await DB.deleteFrom("pb").where("user_id", "=", userId).execute();

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		const pbs = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.execute();
		expect(pbs).toHaveLength(1);
	});

	it("inserts multiple pbs across charts", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		const extra = ["test1", "test2", "test3"] as const;

		for (let i = 0; i < extra.length; i++) {
			await seedExtraChart(extra[i]!, 2 + i);
		}

		await insertIidxScoreRow({
			userId,
			scoreId: randomBytes(10).toString("hex"),
			chartId: "test1",
			timeMs: 1000,
		});
		await insertIidxScoreRow({
			userId,
			scoreId: randomBytes(10).toString("hex"),
			chartId: "test2",
			timeMs: 2000,
		});
		await insertIidxScoreRow({
			userId,
			scoreId: randomBytes(10).toString("hex"),
			chartId: "test3",
			timeMs: 3000,
		});
		await insertIidxScoreRow({
			userId,
			scoreId: randomBytes(10).toString("hex"),
			chartId: Testing511SPA.chartID,
			timeMs: 4000,
		});

		await DB.deleteFrom("pb").where("user_id", "=", userId).execute();

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID, ...extra]), log);

		const pbs = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.execute();
		expect(pbs).toHaveLength(4);
	});

	it("deletes a stale pb row when the user has no remaining scores on the chart (#1521)", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const scoreId = randomBytes(10).toString("hex");

		await insertIidxScoreRow({
			userId,
			scoreId,
			chartId: Testing511SPA.chartID,
			timeMs: 1000,
		});

		// Create the PB.
		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbBefore).toBeDefined();

		// Delete the only score so the chart has no scores left.
		await DB.deleteFrom("pb_composed_from").where("score_id", "=", scoreId).execute();
		await DB.deleteFrom("score").where("score.id", "=", scoreId).execute();

		// ProcessPBs should now delete the stale pb row instead of leaving it.
		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbAfter).toBeUndefined();
	});

	it("also clears pb_composed_from when deleting a stale pb", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const scoreId = randomBytes(10).toString("hex");

		await insertIidxScoreRow({
			userId,
			scoreId,
			chartId: Testing511SPA.chartID,
			timeMs: 1000,
		});

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirstOrThrow();

		// Verify pb_composed_from was created.
		const composedBefore = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbBefore.row_id)
			.execute();
		expect(composedBefore.length).toBeGreaterThan(0);

		await DB.deleteFrom("pb_composed_from").where("score_id", "=", scoreId).execute();
		await DB.deleteFrom("score").where("score.id", "=", scoreId).execute();

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		// Both the pb row and any residual pb_composed_from entries must be gone.
		const composedAfter = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbBefore.row_id)
			.execute();
		expect(composedAfter).toHaveLength(0);

		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.row_id", "=", pbBefore.row_id)
			.executeTakeFirst();
		expect(pbAfter).toBeUndefined();
	});

	it("does not delete the pb for a chart that still has other scores", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();

		const keepScoreId = randomBytes(10).toString("hex");
		const deleteScoreId = randomBytes(10).toString("hex");

		await insertIidxScoreRow({
			userId,
			scoreId: keepScoreId,
			chartId: Testing511SPA.chartID,
			timeMs: 1000,
		});
		await insertIidxScoreRow({
			userId,
			scoreId: deleteScoreId,
			chartId: Testing511SPA.chartID,
			timeMs: 2000,
		});

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		// Remove only the second score, leaving the first.
		await DB.deleteFrom("pb_composed_from").where("score_id", "=", deleteScoreId).execute();
		await DB.deleteFrom("score").where("score.id", "=", deleteScoreId).execute();

		await ProcessPBs("iidx-sp", userId, new Set([Testing511SPA.chartID]), log);

		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbAfter).toBeDefined();
	});
});
