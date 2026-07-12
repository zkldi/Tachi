import { ONE_DAY } from "#lib/constants/time";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

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

/** Snapshots spaced so they fall into different duration buckets (see ONE_YEAR = 336d). */
async function seedHistorySnapshots(userId: number) {
	const now = Date.now();
	const emptyRatings = JSON.stringify({});
	const emptyClasses = JSON.stringify({});
	const emptyRankings = JSON.stringify({});

	await DB.insertInto("game_stats_snapshot")
		.values([
			{
				user_id: userId,
				game: "iidx-sp",
				timestamp: new Date(now - 400 * ONE_DAY).toISOString(),
				playcount: 100,
				ratings: emptyRatings,
				classes: emptyClasses,
				rankings: emptyRankings,
			},
			{
				user_id: userId,
				game: "iidx-sp",
				timestamp: new Date(now - 800 * ONE_DAY).toISOString(),
				playcount: 200,
				ratings: emptyRatings,
				classes: emptyClasses,
				rankings: emptyRankings,
			},
			{
				user_id: userId,
				game: "iidx-sp",
				timestamp: new Date(now - 1200 * ONE_DAY).toISOString(),
				playcount: 300,
				ratings: emptyRatings,
				classes: emptyClasses,
				rankings: emptyRankings,
			},
		])
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/history", () => {
	it("returns 400 for an invalid duration query", async () => {
		const { id } = await seedUser({ username: `ugpt_hist_bad_${Date.now()}` });
		await seedIidxSpProfile(id);

		const res = await mockApi.get(`/api/v1/users/${id}/games/iidx-sp/history?duration=invalid`);

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("defaults to 3 months and excludes older snapshots", async () => {
		const { id } = await seedUser({ username: `ugpt_hist_default_${Date.now()}` });
		await seedIidxSpProfile(id);
		await seedHistorySnapshots(id);

		const res = await mockApi.get(`/api/v1/users/${id}/games/iidx-sp/history`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toHaveLength(1);
	});

	it("duration=year excludes snapshots older than one year", async () => {
		const { id } = await seedUser({ username: `ugpt_hist_year_${Date.now()}` });
		await seedIidxSpProfile(id);
		await seedHistorySnapshots(id);

		const res = await mockApi.get(`/api/v1/users/${id}/games/iidx-sp/history?duration=year`);

		expect(res.status).toBe(200);
		expect(res.body.body.map((row: { playcount: number }) => row.playcount)).toEqual([0]);
	});

	it("duration=all returns every stored snapshot", async () => {
		const { id } = await seedUser({ username: `ugpt_hist_all_${Date.now()}` });
		await seedIidxSpProfile(id);
		await seedHistorySnapshots(id);

		const res = await mockApi.get(`/api/v1/users/${id}/games/iidx-sp/history?duration=all`);

		expect(res.status).toBe(200);
		const playcounts = res.body.body.map((row: { playcount: number }) => row.playcount);
		expect(playcounts.sort((a: number, b: number) => a - b)).toEqual([0, 100, 200, 300]);
	});
});
