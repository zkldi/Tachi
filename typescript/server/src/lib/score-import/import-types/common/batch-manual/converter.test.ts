import type { KtLogger } from "#lib/log/log";
import type { MatchTypeResolver } from "tachi-common";

import DB from "#services/pg/db";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { BatchManualContext } from "./types";

import { ConverterBatchManual, ResolveSongAndChart } from "./converter";

function mkLog(): KtLogger {
	return {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	} as unknown as KtLogger;
}

async function seedWaccaChart(opts: {
	difficulty: string;
	inGameID: number;
	isPrimary?: boolean;
	suffix: string;
	title?: string;
	versions?: Array<string>;
}) {
	const songId = `song-wacca-${opts.suffix}`;
	const chartId = `chart-wacca-${opts.suffix}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			game_group: "wacca",
			title: opts.title ?? `Wacca Seed ${opts.suffix}`,
			artist: "Seed Artist",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({ genre: "Test", displayVersion: null }),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `leg-${opts.suffix}`,
			game: "wacca",
			song_id: songId,
			level: "10",
			level_num: 10,
			is_primary: opts.isPrimary ?? true,
			difficulty: opts.difficulty,
			versions: opts.versions ?? [],
			data: JSON.stringify({ inGameID: opts.inGameID }),
		})
		.execute();

	return { songId, chartId };
}

async function seedMaimaiChart(opts: {
	difficulty: string;
	inGameID: number;
	inGameStrID: string;
	isPrimary?: boolean;
	suffix: string;
	versions?: Array<string>;
}) {
	const songId = `song-maimai-${opts.suffix}`;
	const chartId = `chart-maimai-${opts.suffix}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			game_group: "maimai",
			title: `Maimai Seed ${opts.suffix}`,
			artist: "Seed Artist",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({
				titleJP: "テスト",
				artistJP: "アーティスト",
				displayVersion: "UNiVERSE",
			}),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `leg-m-${opts.suffix}`,
			game: "maimai",
			song_id: songId,
			level: "12+",
			level_num: 12.7,
			is_primary: opts.isPrimary ?? true,
			difficulty: opts.difficulty,
			versions: opts.versions ?? [],
			data: JSON.stringify({
				inGameID: opts.inGameID,
				inGameStrID: opts.inGameStrID,
				maxPercent: 100,
			}),
		})
		.execute();

	return { songId, chartId };
}

async function seedPopnChart(opts: { hashSHA256: string; suffix: string }) {
	const songId = `song-popn-${opts.suffix}`;
	const chartId = `chart-popn-${opts.suffix}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			game_group: "popn",
			title: `Popn Seed ${opts.suffix}`,
			artist: "Seed Artist",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({
				genre: "Test",
				genreEN: "Test",
				displayVersion: null,
			}),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `leg-p-${opts.suffix}`,
			game: "popn",
			song_id: songId,
			level: "40",
			level_num: 40,
			is_primary: true,
			difficulty: "EXPERT",
			versions: [],
			data: JSON.stringify({ inGameID: 1, hashSHA256: opts.hashSHA256 }),
		})
		.execute();

	return { songId, chartId };
}

async function seedDDRForHash(opts: {
	ddrSongHash: string;
	difficulty: string;
	isPrimary?: boolean;
	suffix: string;
	versions?: Array<string>;
}) {
	const songId = `song-ddr-${opts.suffix}`;
	const chartId = `chart-ddr-${opts.suffix}`;

	await DB.insertInto("song")
		.values({
			id: songId,
			game_group: "ddr",
			title: `DDR Seed ${opts.suffix}`,
			artist: "Seed Artist",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({
				inGameID: 1,
				flareCategory: "CLASSIC",
				ddrSongHash: opts.ddrSongHash,
			}),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `leg-d-${opts.suffix}`,
			game: "ddr-sp",
			song_id: songId,
			level: "10",
			level_num: 10,
			is_primary: opts.isPrimary ?? true,
			difficulty: opts.difficulty,
			versions: opts.versions ?? [],
			data: JSON.stringify({ inGameID: 1 }),
		})
		.execute();

	return { songId, chartId };
}

describe("ResolveSongAndChart (Postgres)", () => {
	it("rejects gcmInGameIDSpecialChart on non-GCM games", async () => {
		const r: MatchTypeResolver = {
			game: "wacca",
			version: null,
			identifier: "1",
			matchType: "gcmInGameIDSpecialChart",
		};

		await expect(ResolveSongAndChart(r, mkLog())).rejects.toMatchObject({
			message: expect.stringMatching(/gcmInGameIDSpecialChart/u),
		});
	});

	it("resolves gcmInGameIDSpecialChart when that in-game ID matches exactly one chart", async () => {
		const suffix = `${Date.now()}-gcm-uniq`;
		const inGameID = 8_800_000 + Math.floor(Math.random() * 1000);
		await seedMaimaiChart({
			suffix,
			inGameID,
			inGameStrID: `str-gcm-${suffix}`,
			difficulty: "Master",
		});

		const r: MatchTypeResolver = {
			game: "maimai",
			version: null,
			identifier: String(inGameID),
			matchType: "gcmInGameIDSpecialChart",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.data).toMatchObject({ inGameID });
		expect(got!.chart.difficulty).toBe("Master");
	});

	it("returns null for gcmInGameIDSpecialChart when multiple charts share the in-game ID", async () => {
		const suffix = `${Date.now()}-gcm-dup`;
		const inGameID = 8_801_000 + Math.floor(Math.random() * 1000);
		await seedMaimaiChart({
			suffix: `${suffix}-a`,
			inGameID,
			inGameStrID: `str-gcm-a-${suffix}`,
			difficulty: "Master",
		});
		await seedMaimaiChart({
			suffix: `${suffix}-b`,
			inGameID,
			inGameStrID: `str-gcm-b-${suffix}`,
			difficulty: "Expert",
		});

		const r: MatchTypeResolver = {
			game: "maimai",
			version: null,
			identifier: String(inGameID),
			matchType: "gcmInGameIDSpecialChart",
		};

		expect(await ResolveSongAndChart(r, mkLog())).toBeNull();
	});

	it("resolves tachiSongID + chart via PTDF", async () => {
		const suffix = `${Date.now()}-tachi`;
		await seedWaccaChart({
			suffix,
			inGameID: 42,
			difficulty: "EXPERT",
		});
		const songId = `song-wacca-${suffix}`;

		const r: MatchTypeResolver = {
			game: "wacca",
			version: null,
			identifier: songId,
			matchType: "tachiSongID",
			difficulty: "EXPERT",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.song.id).toBe(songId);
		expect(got!.chart.difficulty).toBe("EXPERT");
	});

	it("resolves songTitle (case-insensitive) + chart", async () => {
		const suffix = `${Date.now()}-title`;
		const title = `Unique Title XYZ ${suffix}`;
		await seedWaccaChart({
			suffix,
			inGameID: 43,
			difficulty: "HARD",
			title,
		});

		const r: MatchTypeResolver = {
			game: "wacca",
			version: null,
			identifier: title.toLowerCase(),
			matchType: "songTitle",
			difficulty: "HARD",
			artist: "Seed Artist",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.song.title).toBe(title);
		expect(got!.chart.difficulty).toBe("HARD");
	});

	it("resolves inGameID with primary chart", async () => {
		const suffix = `${Date.now()}-igid`;
		const inGameID = 9_001;
		await seedWaccaChart({
			suffix,
			inGameID,
			difficulty: "NORMAL",
			isPrimary: true,
		});

		const r: MatchTypeResolver = {
			game: "wacca",
			version: null,
			identifier: String(inGameID),
			matchType: "inGameID",
			difficulty: "NORMAL",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.data).toMatchObject({ inGameID });
	});

	it("resolves inGameID with a specific version", async () => {
		const suffix = `${Date.now()}-igver`;
		const inGameID = 9_002;
		await seedWaccaChart({
			suffix,
			inGameID,
			difficulty: "INFERNO",
			isPrimary: false,
			versions: ["reverse"],
		});

		const r: MatchTypeResolver = {
			game: "wacca",
			version: "reverse",
			identifier: String(inGameID),
			matchType: "inGameID",
			difficulty: "INFERNO",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.versions).toContain("reverse");
	});

	it("returns null when inGameID does not match", async () => {
		const r: MatchTypeResolver = {
			game: "wacca",
			version: null,
			identifier: "999999991",
			matchType: "inGameID",
			difficulty: "EXPERT",
		};

		expect(await ResolveSongAndChart(r, mkLog())).toBeNull();
	});

	it("resolves inGameStrID with primary chart", async () => {
		const suffix = `${Date.now()}-strid`;
		const strId = `str-${suffix}`;
		await seedMaimaiChart({
			suffix,
			inGameID: 100,
			inGameStrID: strId,
			difficulty: "Master",
		});

		const r: MatchTypeResolver = {
			game: "maimai",
			version: null,
			identifier: strId,
			matchType: "inGameStrID",
			difficulty: "Master",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.data).toMatchObject({ inGameStrID: strId });
	});

	it("resolves inGameStrID with version", async () => {
		const suffix = `${Date.now()}-strver`;
		const strId = `strv-${suffix}`;
		await seedMaimaiChart({
			suffix,
			inGameID: 101,
			inGameStrID: strId,
			difficulty: "Expert",
			isPrimary: false,
			versions: ["finale"],
		});

		const r: MatchTypeResolver = {
			game: "maimai",
			version: "finale",
			identifier: strId,
			matchType: "inGameStrID",
			difficulty: "Expert",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.versions).toContain("finale");
	});

	it("resolves popnChartHash", async () => {
		const suffix = `${Date.now()}-popn`;
		const h = randomBytes(32).toString("hex");
		await seedPopnChart({ suffix, hashSHA256: h });
		const songId = `song-popn-${suffix}`;

		const r: MatchTypeResolver = {
			game: "popn",
			version: null,
			identifier: h,
			matchType: "popnChartHash",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.song.id).toBe(songId);
		expect((got!.chart.data as { hashSHA256?: string }).hashSHA256).toBe(h);
	});

	it("resolves ddrSongHash to song + chart", async () => {
		const suffix = `${Date.now()}-ddr`;
		const ddrSongHash = `hash-${suffix}`;
		await seedDDRForHash({
			suffix,
			ddrSongHash,
			difficulty: "EXPERT",
		});

		const r: MatchTypeResolver = {
			game: "ddr-sp",
			version: null,
			identifier: ddrSongHash,
			matchType: "ddrSongHash",
			difficulty: "EXPERT",
		};

		const songId = `song-ddr-${suffix}`;
		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.song.id).toBe(songId);
		expect(got!.chart.difficulty).toBe("EXPERT");
	});

	it("resolves ddrSongHash with version", async () => {
		const suffix = `${Date.now()}-ddrv`;
		const ddrSongHash = `hashv-${suffix}`;
		await seedDDRForHash({
			suffix,
			ddrSongHash,
			difficulty: "CHALLENGE",
			isPrimary: false,
			versions: ["world"],
		});

		const r: MatchTypeResolver = {
			game: "ddr-sp",
			version: "world",
			identifier: ddrSongHash,
			matchType: "ddrSongHash",
			difficulty: "CHALLENGE",
		};

		const got = await ResolveSongAndChart(r, mkLog());
		expect(got).not.toBeNull();
		expect(got!.chart.versions).toContain("world");
	});

	it("suggests sdvxInGameID when sdvx is given inGameID", async () => {
		const r: MatchTypeResolver = {
			game: "sdvx",
			version: null,
			identifier: "1",
			matchType: "inGameID",
			difficulty: "NOVICE",
		};

		await expect(ResolveSongAndChart(r, mkLog())).rejects.toMatchObject({
			message: expect.stringMatching(/sdvxInGameID/u),
		});
	});
});

describe("ConverterBatchManual", () => {
	it("does not throw when legacy context stores game group + playtype (e.g. orphaned ir/direct-manual)", async () => {
		const data = {
			score: 1,
			lamp: "CLEAR" as const,
			matchType: "uscChartHash" as const,
			identifier: "0000000000000000000000000000000000000000",
		};

		const context = {
			game: "usc",
			playtype: "Keyboard",
			service: "test",
			version: null,
		} as unknown as BatchManualContext;

		await expect(
			ConverterBatchManual(data, context, "ir/direct-manual", mkLog()),
		).rejects.toMatchObject({ failureType: "SongOrChartNotFound" });
	});
});
