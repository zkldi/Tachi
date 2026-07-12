import {
	CURRENT_JUBEAT_HOT_VERSION,
	GetBestJubilityOnSongs,
	GetPBsForJubility,
	JUBEAT_IMPL,
} from "#game-implementations/games/jubeat";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

let jubeatSeedCounter = 0;

async function seedJubeatSong(args: { displayVersion: string; songID: string }): Promise<void> {
	const n = ++jubeatSeedCounter;
	await DB.insertInto("song")
		.values({
			id: args.songID,
			legacy_id: n,
			game_group: "jubeat",
			title: "T",
			artist: "A",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({ displayVersion: args.displayVersion }),
			fts_document: "",
		})
		.execute();
}

async function seedJubeatChartPbOnSong(
	userId: number,
	songID: string,
	args: {
		calculatedDataOverride?: Record<string, unknown>;
		difficulty: string;
		isPrimary?: boolean;
		jubility: number;
	},
): Promise<void> {
	const n = ++jubeatSeedCounter;
	const chartId = `jubeat-prof-chart-${n}`;
	const isPrimary = args.isPrimary ?? true;

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: chartId,
			game: "jubeat",
			song_id: songID,
			level: "10",
			level_num: 10,
			is_primary: isPrimary,
			difficulty: args.difficulty,
			versions: [],
			data: JSON.stringify({}),
		})
		.execute();

	const calculatedData = args.calculatedDataOverride ?? { jubility: args.jubility };

	await DB.insertInto("pb")
		.values({
			user_id: userId,
			chart_id: chartId,
			lens: null,
			data: JSON.stringify({}),
			derived_data: JSON.stringify({}),
			calculated_data: JSON.stringify(calculatedData),
			judgements: JSON.stringify({}),
			ranking_value: args.jubility,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: null,
		})
		.execute();
}

async function seedJubeatSongChartPb(
	userId: number,
	args: {
		calculatedDataOverride?: Record<string, unknown>;
		difficulty: string;
		displayVersion: string;
		isPrimary?: boolean;
		jubility: number;
		songID: string;
	},
): Promise<void> {
	await seedJubeatSong({
		songID: args.songID,
		displayVersion: args.displayVersion,
	});
	await seedJubeatChartPbOnSong(userId, args.songID, args);
}

describe("GetBestJubilityOnSongs (Postgres)", () => {
	it("returns [] when songIDs is empty", async () => {
		const { id: userId } = await seedUser();

		const rows = await GetBestJubilityOnSongs([], userId, "jubeat", 30);

		expect(rows).toEqual([]);
	});

	it("keeps the highest jubility per (song, bucket); HARD BSC and BSC share the BSC bucket", async () => {
		const { id: userId } = await seedUser();
		const songID = "jubeat-prof-song-400001";

		await seedJubeatSong({
			songID,
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
		});
		await seedJubeatChartPbOnSong(userId, songID, {
			difficulty: "HARD BSC",
			jubility: 100,
		});
		await seedJubeatChartPbOnSong(userId, songID, {
			difficulty: "BSC",
			jubility: 250,
		});

		const rows = await GetBestJubilityOnSongs([songID], userId, "jubeat", 30);

		expect(rows).toHaveLength(1);
		expect(rows[0]!.calculatedData.jubility).toBe(250);
	});

	it("counts separate buckets on the same song as separate rows (BSC + ADV)", async () => {
		const { id: userId } = await seedUser();
		const songID = "jubeat-prof-song-400002";

		await seedJubeatSong({
			songID,
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
		});
		await seedJubeatChartPbOnSong(userId, songID, {
			difficulty: "BSC",
			jubility: 10,
		});
		await seedJubeatChartPbOnSong(userId, songID, {
			difficulty: "ADV",
			jubility: 500,
		});

		const rows = await GetBestJubilityOnSongs([songID], userId, "jubeat", 30);

		expect(rows).toHaveLength(2);
		const jubs = rows.map((r) => r.calculatedData.jubility).sort((a, b) => b! - a!);
		expect(jubs).toEqual([500, 10]);
	});

	it("applies a global jubility limit after bucketing", async () => {
		const { id: userId } = await seedUser();
		const limit = 5;
		const songIDs = Array.from({ length: 7 }, (_, i) => `jubeat-prof-song-400100${i}`);

		await Promise.all(
			songIDs.map((songID, i) =>
				seedJubeatSongChartPb(userId, {
					songID,
					displayVersion: CURRENT_JUBEAT_HOT_VERSION,
					difficulty: "EXT",
					jubility: 100 + i,
				}),
			),
		);

		const rows = await GetBestJubilityOnSongs(songIDs, userId, "jubeat", limit);

		expect(rows).toHaveLength(limit);
		const jubs = rows.map((r) => r.calculatedData.jubility!).sort((a, b) => b - a);
		expect(jubs).toEqual([106, 105, 104, 103, 102]);
	});

	it("drops charts whose difficulty does not map to a jubility bucket", async () => {
		const { id: userId } = await seedUser();
		const songID = "jubeat-prof-song-400003";

		await seedJubeatSongChartPb(userId, {
			songID,
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
			difficulty: "NOT_A_REAL_BUCKET",
			jubility: 9999,
		});

		const rows = await GetBestJubilityOnSongs([songID], userId, "jubeat", 30);

		expect(rows).toEqual([]);
	});
});

describe("GetPBsForJubility (Postgres)", () => {
	it("returns empty pickUp and other when there are no jubeat songs", async () => {
		const { id: userId } = await seedUser();

		const { bestHotScores, bestScores } = await GetPBsForJubility(userId);

		expect(bestHotScores).toEqual([]);
		expect(bestScores).toEqual([]);
	});

	it("places hot-pool songs in pickUp and other versions in other", async () => {
		const { id: userId } = await seedUser();

		await seedJubeatSongChartPb(userId, {
			songID: "jubeat-prof-song-400200",
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
			difficulty: "EXT",
			jubility: 50,
		});
		await seedJubeatSongChartPb(userId, {
			songID: "jubeat-prof-song-400201",
			displayVersion: "old",
			difficulty: "EXT",
			jubility: 80,
		});

		const { bestHotScores, bestScores } = await GetPBsForJubility(userId);

		expect(bestHotScores).toHaveLength(1);
		expect(bestHotScores[0]!.songID).toBe("jubeat-prof-song-400200");
		expect(bestHotScores[0]!.calculatedData.jubility).toBe(50);

		expect(bestScores).toHaveLength(1);
		expect(bestScores[0]!.songID).toBe("jubeat-prof-song-400201");
		expect(bestScores[0]!.calculatedData.jubility).toBe(80);
	});

	it("treats missing displayVersion as cold (IS DISTINCT FROM hot pool)", async () => {
		const { id: userId } = await seedUser();
		const n = ++jubeatSeedCounter;
		const songID = `jubeat-prof-song-${n}`;
		const chartId = `jubeat-prof-chart-${n}`;

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: n,
				game_group: "jubeat",
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
				game: "jubeat",
				song_id: songID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "EXT",
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
				calculated_data: JSON.stringify({ jubility: 33 }),
				judgements: JSON.stringify({}),
				ranking_value: 33,
				ranking_value_tb1: null,
				ranking_value_tb2: null,
				ranking_value_tb3: null,
				ranking_value_tb4: null,
				ranking_value_tb5: null,
				highlight: false,
				time_achieved: null,
			})
			.execute();

		const { bestHotScores, bestScores } = await GetPBsForJubility(userId);

		expect(bestHotScores).toEqual([]);
		expect(bestScores).toHaveLength(1);
		expect(bestScores[0]!.calculatedData.jubility).toBe(33);
	});
});

describe("JUBEAT_IMPL.profileCalcs (Postgres)", () => {
	it("computes jubility from hot + cold pick lists and naiveJubility from top 60 primary PBs", async () => {
		const { id: userId } = await seedUser();

		await seedJubeatSongChartPb(userId, {
			songID: "jubeat-prof-song-400300",
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
			difficulty: "EXT",
			jubility: 100,
		});
		await seedJubeatSongChartPb(userId, {
			songID: "jubeat-prof-song-400301",
			displayVersion: "cold",
			difficulty: "EXT",
			jubility: 200,
		});

		const result = await JUBEAT_IMPL.profileCalcs("jubeat", userId);

		expect(result.jubility).toBe(300);
		expect(result.naiveJubility).toBe(300);
	});

	it("sums naiveJubility across up to 60 best primary PBs by jubility", async () => {
		const { id: userId } = await seedUser();

		await Promise.all(
			Array.from({ length: 3 }, (_, i) =>
				seedJubeatSongChartPb(userId, {
					songID: `jubeat-prof-song-400400${i}`,
					displayVersion: CURRENT_JUBEAT_HOT_VERSION,
					difficulty: "EXT",
					jubility: 10 * (i + 1),
				}),
			),
		);

		const result = await JUBEAT_IMPL.profileCalcs("jubeat", userId);

		expect(result.naiveJubility).toBe(10 + 20 + 30);
	});

	it("ignores non-primary charts for naiveJubility only", async () => {
		const { id: userId } = await seedUser();

		await seedJubeatSongChartPb(userId, {
			songID: "jubeat-prof-song-400500",
			displayVersion: CURRENT_JUBEAT_HOT_VERSION,
			difficulty: "EXT",
			isPrimary: false,
			jubility: 5000,
		});

		const result = await JUBEAT_IMPL.profileCalcs("jubeat", userId);

		expect(result.naiveJubility).toBeNull();
		expect(result.jubility).toBe(5000);
	});

	it("matches weighted jubility when hot pool contributes capped rows", async () => {
		const { id: userId } = await seedUser();
		const songIDs = Array.from({ length: 31 }, (_, i) => `jubeat-prof-song-400600${i}`);

		await Promise.all(
			songIDs.map((songID, i) =>
				seedJubeatSongChartPb(userId, {
					songID,
					displayVersion: CURRENT_JUBEAT_HOT_VERSION,
					difficulty: "EXT",
					jubility: 1000 + i,
				}),
			),
		);

		const { bestHotScores } = await GetPBsForJubility(userId);
		const expectedHotSum = bestHotScores.reduce(
			(a, e) => a + (e.calculatedData.jubility ?? 0),
			0,
		);

		const result = await JUBEAT_IMPL.profileCalcs("jubeat", userId);

		expect(bestHotScores).toHaveLength(30);
		expect(expectedHotSum).toBe(
			Array.from({ length: 30 }, (_, k) => 1000 + 30 - k).reduce((a, b) => a + b, 0),
		);
		expect(result.jubility).toBe(expectedHotSum);
	});
});
