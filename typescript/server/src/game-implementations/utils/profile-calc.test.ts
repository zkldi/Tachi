import { ProfileAvgBestN, ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

let chartCounter = 0;

async function seedChunithmChartsWithPbs(userId: number, ratings: Array<number>): Promise<void> {
	const start = chartCounter;
	await Promise.all(
		ratings.map(async (rating, i) => {
			const n = start + i + 1;
			const songId = `song-pc-${n}`;
			const chartId = `chart-pc-${n}`;

			await DB.insertInto("song")
				.values({
					id: songId,
					legacy_id: n,
					game_group: "chunithm",
					title: "T",
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
					legacy_id: chartId,
					game: "chunithm",
					song_id: songId,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "MASTER",
					versions: [],
					data: JSON.stringify({}),
				})
				.execute();

			await DB.insertInto("pb")
				.values({
					user_id: userId,
					chart_id: chartId,
					lens: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					calculated_data: JSON.stringify({ rating }),
					judgements: JSON.stringify({}),
					ranking_value: rating,
					ranking_value_tb1: null,
					ranking_value_tb2: null,
					ranking_value_tb3: null,
					ranking_value_tb4: null,
					ranking_value_tb5: null,
					highlight: false,
					time_achieved: null,
				})
				.execute();
		}),
	);
	chartCounter += ratings.length;
}

describe("profile-calc (Postgres)", () => {
	it("ProfileAvgBestN: mean of top 50 ratings (full set)", async () => {
		const { id: userId } = await seedUser();
		await seedChunithmChartsWithPbs(userId, Array(50).fill(17.15));

		const fn = ProfileAvgBestN("rating", 50, false, 100);
		const result = await fn("chunithm", userId);

		expect(result).toBe(17.15);
	});

	it("ProfileAvgBestN: fewer than N scores still divides by N (nullIfNotEnoughScores false)", async () => {
		const { id: userId } = await seedUser();
		await seedChunithmChartsWithPbs(userId, [16, 16, 16, 16]);

		const fn = ProfileAvgBestN("rating", 50, false, 100);
		const result = await fn("chunithm", userId);

		expect(result).toBe(1.28);
	});

	it("ProfileAvgBestN: null when fewer than N scores and nullIfNotEnoughScores", async () => {
		const { id: userId } = await seedUser();
		await seedChunithmChartsWithPbs(userId, [16, 16, 16, 16]);

		const fn = ProfileAvgBestN("rating", 50, true, 100);
		const result = await fn("chunithm", userId);

		expect(result).toBeNull();
	});

	it("ProfileSumBestN: sums top N", async () => {
		const { id: userId } = await seedUser();
		await seedChunithmChartsWithPbs(userId, [10, 20, 30]);

		const fn = ProfileSumBestN("rating", 2);
		const result = await fn("chunithm", userId);

		expect(result).toBe(50);
	});

	it("returns null when no numeric rating key", async () => {
		const { id: userId } = await seedUser();
		const n = ++chartCounter;
		const songId = `song-pc-null-${n}`;
		const chartId = `chart-pc-null-${n}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: n,
				game_group: "chunithm",
				title: "T",
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
				legacy_id: chartId,
				game: "chunithm",
				song_id: songId,
				level: "12",
				level_num: 12,
				is_primary: true,
				difficulty: "MASTER",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("pb")
			.values({
				user_id: userId,
				chart_id: chartId,
				lens: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				calculated_data: JSON.stringify({ rating: "not-a-number" }),
				judgements: JSON.stringify({}),
				ranking_value: 0,
				ranking_value_tb1: null,
				ranking_value_tb2: null,
				ranking_value_tb3: null,
				ranking_value_tb4: null,
				ranking_value_tb5: null,
				highlight: false,
				time_achieved: null,
			})
			.execute();

		const fn = ProfileSumBestN("rating", 5);
		const result = await fn("chunithm", userId);

		expect(result).toBeNull();
	});
});
