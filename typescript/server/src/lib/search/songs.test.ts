import { GetChartsBySongId } from "#lib/db-formats/chart";
import { SearchGlobalGameSongsAndCharts } from "#lib/search/song-charts";
import DB from "#services/pg/db";
import { ImportSeedsSubsetForTests } from "#services/pg/seeds";
import { seedUser } from "#test-utils/pg-fixtures";
import { resolveSeedsDir, seedsJsonAvailable } from "#test-utils/seed-paths";
import { FindChartsOnPopularity } from "#utils/queries/charts";
import { sql } from "kysely";
import { LEGACY_GameGroupPTToGame } from "tachi-common";
import { describe, expect, it } from "vitest";

import {
	LoadSongChildrenForPgIds,
	MAX_SONG_SEARCH_RESULTS_PER_GAME,
	SearchSongsForGameFtsAndTrgm,
	SearchSpecificGameSongs,
	SHORT_QUERY_STRICT_MAX_LEN,
} from "./songs";

function makeSongId(n: number): string {
	return `S${n.toString(16).padStart(20, "0")}`;
}

function makeChartId(n: number): string {
	return `C${n.toString(16).padStart(20, "0")}`;
}

function makeScoreId(n: number): string {
	return `SC${n.toString(16).padStart(20, "0")}`;
}

async function countSongRows(): Promise<number> {
	const { rows } = await sql<{ c: bigint }>`
		SELECT count(*)::bigint AS c FROM song
	`.execute(DB);

	return Number(rows[0]?.c ?? 0);
}

/**
 * Strings that would be dangerous if concatenated into SQL as raw text.
 * Kysely `sql`…`${value}` binds values as parameters, so these must not execute as SQL.
 */
const HOSTILE_SEARCH_PAYLOADS = [
	"'; DROP TABLE song; --",
	"1' OR '1'='1",
	"1; DELETE FROM song WHERE 1=1;--",
	"' OR 1=1--",
	"') OR ('a'='a",
	"\\'; SELECT pg_sleep(10);--",
	'" UNION SELECT * FROM account--',
];

describe("SearchSongsForGameFtsAndTrgm (synthetic rows)", () => {
	it("returns no rows for empty or whitespace search", async () => {
		await DB.insertInto("song")
			.values({
				id: makeSongId(1),
				legacy_id: 9_000_001,
				game_group: "iidx",
				title: "Empty Query Test",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		expect(await SearchSongsForGameFtsAndTrgm("iidx", "", 10)).toEqual([]);
		expect(await SearchSongsForGameFtsAndTrgm("iidx", "   ", 10)).toEqual([]);
	});

	it("matches FTS on title and respects game_group", async () => {
		await DB.insertInto("song")
			.values([
				{
					id: makeSongId(2),
					legacy_id: 9_000_002,
					game_group: "iidx",
					title: "UniqueAlphaToken",
					artist: "Artist A",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(3),
					legacy_id: 9_000_003,
					game_group: "sdvx",
					title: "UniqueAlphaToken Other Game",
					artist: "Artist B",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		const iidx = await SearchSongsForGameFtsAndTrgm("iidx", "UniqueAlphaToken", 10);

		expect(iidx).toHaveLength(1);
		expect(iidx[0]?.legacy_id).toBe(9_000_002);
	});

	it("loads search terms and alt titles via LoadSongChildrenForPgIds", async () => {
		const sid = makeSongId(4);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_004,
				game_group: "iidx",
				title: "Child Row Test",
				artist: "Z",
				search_terms: ["synonym"],
				alt_titles: ["Extra JP"],
				fts_document: "synonym extra",
				data: JSON.stringify({}),
			})
			.execute();

		const rows = await SearchSongsForGameFtsAndTrgm("iidx", "Child", 10);
		const children = await LoadSongChildrenForPgIds(rows.map((r) => r.id));

		expect(children.get(sid)).toEqual({
			searchTerms: ["synonym"],
			altTitles: ["Extra JP"],
		});
	});

	it("caps results at MAX_SONG_SEARCH_RESULTS_PER_GAME even when limit is higher", async () => {
		const rows = Array.from({ length: 150 }, (_, i) => ({
			id: makeSongId(100 + i),
			legacy_id: 9_100_000 + i,
			game_group: "iidx" as const,
			title: `CapBulk ${i}`,
			artist: "Cap Artist",
			search_terms: [],
			alt_titles: [],
			fts_document: "",
			data: JSON.stringify({}),
		}));

		await DB.insertInto("song").values(rows).execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "CapBulk", 500);

		expect(res.length).toBe(MAX_SONG_SEARCH_RESULTS_PER_GAME);
	});

	it("finds a two-letter title via exact match (strict short query, not substring trgm)", async () => {
		await DB.insertInto("song")
			.values({
				id: makeSongId(300),
				legacy_id: 9_000_300,
				game_group: "iidx",
				title: "Qx",
				artist: "ShortQ Artist",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "Qx", 10);

		expect(res.some((r) => r.legacy_id === 9_000_300)).toBe(true);
	});
});

describe("SearchSongsForGameFtsAndTrgm (very short titles / strict query)", () => {
	it("does not flood results for a single-letter search: only exact title/artist (and terms)", async () => {
		await DB.insertInto("song")
			.values([
				{
					id: makeSongId(700),
					legacy_id: 9_000_700,
					game_group: "iidx",
					title: "A",
					artist: "Some Artist",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(701),
					legacy_id: 9_000_701,
					game_group: "iidx",
					title: "About Something",
					artist: "B",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(702),
					legacy_id: 9_000_702,
					game_group: "iidx",
					title: "Many Letters",
					artist: "Alpha",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "A", 20);
		const legacyIds = res.map((r) => r.legacy_id);

		expect(legacyIds).toContain(9_000_700);
		expect(legacyIds).not.toContain(9_000_701);
		expect(legacyIds).not.toContain(9_000_702);
	});

	it("distinguishes one-letter title from two-letter title when searching one letter", async () => {
		await DB.insertInto("song")
			.values([
				{
					id: makeSongId(710),
					legacy_id: 9_000_710,
					game_group: "iidx",
					title: "A",
					artist: "X",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(711),
					legacy_id: 9_000_711,
					game_group: "iidx",
					title: "AA",
					artist: "Y",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		const one = await SearchSongsForGameFtsAndTrgm("iidx", "A", 20);

		expect(one.map((r) => r.legacy_id)).toContain(9_000_710);
		expect(one.map((r) => r.legacy_id)).not.toContain(9_000_711);

		const two = await SearchSongsForGameFtsAndTrgm("iidx", "AA", 20);

		expect(two.map((r) => r.legacy_id)).toContain(9_000_711);
		expect(two.map((r) => r.legacy_id)).not.toContain(9_000_710);
	});

	it("matches exact search_term when query is within strict length", async () => {
		const sid = makeSongId(720);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_720,
				game_group: "iidx",
				title: "Long Title",
				artist: "Z",
				search_terms: ["V"],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "V", 10);

		expect(res.some((r) => r.id === sid)).toBe(true);
	});

	it("still uses substring trgm for three-character queries when FTS is weak", async () => {
		expect(SHORT_QUERY_STRICT_MAX_LEN).toBe(2);

		await DB.insertInto("song")
			.values({
				id: makeSongId(730),
				legacy_id: 9_000_730,
				game_group: "iidx",
				title: "ZzzUniqueToken",
				artist: "Z",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "Zzz", 10);

		expect(res.some((r) => r.legacy_id === 9_000_730)).toBe(true);
	});
});

describe("SearchSongsForGameFtsAndTrgm (hostile / injection-shaped input)", () => {
	it("does not change song row count when search strings look like SQL injection", async () => {
		await DB.insertInto("song")
			.values([
				{
					id: makeSongId(400),
					legacy_id: 9_000_400,
					game_group: "iidx",
					title: "Bait Song",
					artist: "Bait",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(401),
					legacy_id: 9_000_401,
					game_group: "iidx",
					title: "Other Bait",
					artist: "Bait",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		const before = await countSongRows();

		await Promise.all(
			HOSTILE_SEARCH_PAYLOADS.map(async (payload) => {
				await SearchSongsForGameFtsAndTrgm("iidx", payload, 10);
				expect(await countSongRows()).toBe(before);
			}),
		);
	});

	it("does not change row count via SearchSpecificGameSongs with the same payloads", async () => {
		const before = await countSongRows();

		await Promise.all(
			HOSTILE_SEARCH_PAYLOADS.map(async (payload) => {
				await SearchSpecificGameSongs("iidx", payload, 10);
				expect(await countSongRows()).toBe(before);
			}),
		);
	});

	it("rejects NUL in search string (PostgreSQL UTF-8 text; not SQL injection)", async () => {
		await DB.insertInto("song")
			.values({
				id: makeSongId(600),
				legacy_id: 9_000_600,
				game_group: "iidx",
				title: "NulProbe",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		const before = await countSongRows();

		// TODO(zk): Throwing on nulbytes in strings is spicy
		// but we can't fix this, so whatever.
		await expect(SearchSongsForGameFtsAndTrgm("iidx", "a\x00b", 10)).rejects.toThrow(
			/UTF8|invalid byte sequence|0x00/iu,
		);

		expect(await countSongRows()).toBe(before);
	});

	it("treats ILIKE metacharacters in the search string as literals (no broad % / _ wildcard match)", async () => {
		await DB.insertInto("song")
			.values([
				{
					id: makeSongId(500),
					legacy_id: 9_000_500,
					game_group: "iidx",
					title: "ExactPercent",
					artist: "NoWildcard",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: makeSongId(501),
					legacy_id: 9_000_501,
					game_group: "iidx",
					title: "Something Else Entirely",
					artist: "NoWildcard",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		const pct = await SearchSongsForGameFtsAndTrgm("iidx", "%", 10);
		const titles = pct.map((r) => r.title);

		expect(titles).not.toContain("Something Else Entirely");
	});
});

describe("SearchSpecificGameSongs", () => {
	it("returns __textScore and song document fields", async () => {
		await DB.insertInto("song")
			.values({
				id: makeSongId(5),
				legacy_id: 9_000_005,
				game_group: "iidx",
				title: "ScoreFieldTest",
				artist: "Z",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({ displayVersion: "1" }),
			})
			.execute();

		const songs = await SearchSpecificGameSongs("iidx", "ScoreFieldTest", 10);

		expect(songs).toHaveLength(1);
		expect(songs[0]?.title).toBe("ScoreFieldTest");
		expect(typeof songs[0]?.__textScore).toBe("number");
	});
});

describe("IIDX 2dxtraSet exclusion from search", () => {
	it("excludes songs that only have charts with 2dxtraSet set", async () => {
		const sid = makeSongId(860);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_860,
				game_group: "iidx",
				title: "Only2dxtraSearchToken",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: makeChartId(860),
				legacy_id: "a".repeat(40),
				game: "iidx-sp",
				song_id: sid,
				level: "12",
				level_num: 12,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({ "2dxtraSet": "test-set", notecount: 100 }),
			})
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "Only2dxtraSearchToken", 20);

		expect(res.some((r) => r.legacy_id === 9_000_860)).toBe(false);
	});

	it("includes iidx songs with at least one non-2dxtra chart", async () => {
		const sid = makeSongId(861);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_861,
				game_group: "iidx",
				title: "Mixed2dxtraSearchToken",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: makeChartId(861),
					legacy_id: "b".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ "2dxtraSet": "x", notecount: 100 }),
				},
				{
					id: makeChartId(862),
					legacy_id: "c".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "11",
					level_num: 11,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({ "2dxtraSet": null, notecount: 80 }),
				},
			])
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("iidx", "Mixed2dxtraSearchToken", 20);

		expect(res.some((r) => r.legacy_id === 9_000_861)).toBe(true);
	});

	it("GetChartsBysongNewID omits 2dxtra charts when omit2dxtraCharts is true", async () => {
		const sid = makeSongId(870);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_870,
				game_group: "iidx",
				title: "ChartFilter",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: makeChartId(871),
					legacy_id: "d".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ "2dxtraSet": "x", notecount: 100 }),
				},
				{
					id: makeChartId(872),
					legacy_id: "e".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "11",
					level_num: 11,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({ notecount: 80 }),
				},
			])
			.execute();

		const all = await GetChartsBySongId(LEGACY_GameGroupPTToGame("iidx", "SP"), sid);
		const filtered = await GetChartsBySongId(LEGACY_GameGroupPTToGame("iidx", "SP"), sid, {
			omit2dxtraCharts: true,
		});

		expect(all).toHaveLength(2);
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.difficulty).toBe("HYPER");
	});

	it("SearchGlobalGameSongsAndCharts never returns 2dxtra charts for iidx", async () => {
		const sid = makeSongId(880);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_880,
				game_group: "iidx",
				title: "GlobalSearch2dxtraToken",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: makeChartId(880),
					legacy_id: "f".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ "2dxtraSet": "set-a", notecount: 100 }),
				},
				{
					id: makeChartId(881),
					legacy_id: "0".repeat(40),
					game: "iidx-sp",
					song_id: sid,
					level: "11",
					level_num: 11,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({ notecount: 80 }),
				},
			])
			.execute();

		const rows = await SearchGlobalGameSongsAndCharts("iidx-sp", "GlobalSearch2dxtraToken", 20);

		expect(rows.length).toBeGreaterThan(0);
		expect(
			rows.every((r) => {
				const v = (r.chart.data as Record<string, unknown>)["2dxtraSet"];

				return v === null || v === undefined;
			}),
		).toBe(true);
		expect(rows.some((r) => r.chart.difficulty === "HYPER")).toBe(true);
	});

	it("FindChartsOnPopularity excludes 2dxtra charts for iidx", async () => {
		const songID = makeSongId(890);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_000_890,
				game_group: "iidx",
				title: "Pop2dxtraToken",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: makeChartId(890),
					legacy_id: "1".repeat(40),
					game: "iidx-sp",
					song_id: songID,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ "2dxtraSet": "x", notecount: 100 }),
				},
				{
					id: makeChartId(891),
					legacy_id: "2".repeat(40),
					game: "iidx-sp",
					song_id: songID,
					level: "11",
					level_num: 11,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({ notecount: 80 }),
				},
			])
			.execute();

		const charts = await FindChartsOnPopularity(
			"iidx-sp",
			{ songIDs: [songID], chartIDs: undefined },
			0,
			100,
		);

		expect(charts.length).toBe(1);
		expect(charts[0]?.difficulty).toBe("HYPER");
		expect(
			(charts[0]?.data as { "2dxtraSet"?: string | null })["2dxtraSet"] ?? null,
		).toBeNull();
	});

	it("FindChartsOnPopularity with songIDs only aggregates scores for those songs", async () => {
		const targetSongID = makeSongId(892);
		const otherSongID = makeSongId(893);
		const targetChartID = makeChartId(892);
		const otherChartID = makeChartId(893);

		await DB.insertInto("song")
			.values([
				{
					id: targetSongID,
					legacy_id: 9_000_892,
					game_group: "iidx",
					title: "PopFilterTarget",
					artist: "X",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
				{
					id: otherSongID,
					legacy_id: 9_000_893,
					game_group: "iidx",
					title: "PopFilterOther",
					artist: "X",
					search_terms: [],
					alt_titles: [],
					fts_document: "",
					data: JSON.stringify({}),
				},
			])
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: targetChartID,
					legacy_id: "3".repeat(40),
					game: "iidx-sp",
					song_id: targetSongID,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ notecount: 100 }),
				},
				{
					id: otherChartID,
					legacy_id: "4".repeat(40),
					game: "iidx-sp",
					song_id: otherSongID,
					level: "11",
					level_num: 11,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ notecount: 100 }),
				},
			])
			.execute();

		const { id: userID } = await seedUser({ username: "pop_filter_scores" });
		await DB.insertInto("score")
			.values([
				{
					id: makeScoreId(892),
					user_id: userID,
					chart_id: targetChartID,
					game: "iidx-sp",
					session_id: null,
					import_id: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					judgements: JSON.stringify({}),
					calculated_data: JSON.stringify({}),
					meta: JSON.stringify({}),
					time_achieved: new Date().toISOString(),
					time_added: new Date().toISOString(),
					highlight: false,
					comment: null,
				},
				{
					id: makeScoreId(893),
					user_id: userID,
					chart_id: otherChartID,
					game: "iidx-sp",
					session_id: null,
					import_id: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					judgements: JSON.stringify({}),
					calculated_data: JSON.stringify({}),
					meta: JSON.stringify({}),
					time_achieved: new Date().toISOString(),
					time_added: new Date().toISOString(),
					highlight: false,
					comment: null,
				},
				{
					id: makeScoreId(894),
					user_id: userID,
					chart_id: otherChartID,
					game: "iidx-sp",
					session_id: null,
					import_id: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					judgements: JSON.stringify({}),
					calculated_data: JSON.stringify({}),
					meta: JSON.stringify({}),
					time_achieved: new Date().toISOString(),
					time_added: new Date().toISOString(),
					highlight: false,
					comment: null,
				},
			])
			.execute();

		const charts = await FindChartsOnPopularity(
			"iidx-sp",
			{ songIDs: [targetSongID], chartIDs: undefined },
			0,
			100,
		);

		expect(charts).toHaveLength(1);
		expect(charts[0]?.chartID).toBe(targetChartID);
		expect(charts[0]?.__playcount).toBe(1);
	});

	it("does not apply the iidx 2dxtra song rule to other game groups", async () => {
		const sid = makeSongId(900);

		await DB.insertInto("song")
			.values({
				id: sid,
				legacy_id: 9_000_900,
				game_group: "sdvx",
				title: "Sdvx2dxtraKeyInJson",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: makeChartId(900),
				legacy_id: "3".repeat(40),
				game: "sdvx",
				song_id: sid,
				level: "18",
				level_num: 18,
				is_primary: true,
				difficulty: "EXHAUST",
				versions: [],
				data: JSON.stringify({ "2dxtraSet": "ignored-for-sdvx", notecount: 100 }),
			})
			.execute();

		const res = await SearchSongsForGameFtsAndTrgm("sdvx", "Sdvx2dxtraKeyInJson", 20);

		expect(res.some((r) => r.legacy_id === 9_000_900)).toBe(true);
	});
});

describe("SearchSongsForGameFtsAndTrgm (real seed subset)", () => {
	it.skipIf(!seedsJsonAvailable())(
		"finds known IIDX titles from a small songs-iidx slice",
		async () => {
			await ImportSeedsSubsetForTests(DB, resolveSeedsDir(), {
				gameGroups: ["iidx"],
				maxSongsPerGame: 80,
				includeCharts: false,
			});

			const gradius = await SearchSongsForGameFtsAndTrgm("iidx", "GRADIUSIC CYBER", 20);

			expect(gradius.some((r) => r.title === "GRADIUSIC CYBER")).toBe(true);

			const prince = await SearchSongsForGameFtsAndTrgm("iidx", "Prince on a star", 20);

			expect(prince.some((r) => r.title === "Prince on a star")).toBe(true);
		},
	);
});
