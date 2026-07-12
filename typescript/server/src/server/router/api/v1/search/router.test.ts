import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

let seedCounter = 0;

describe("GET /api/v1/search/chart-hash", () => {
	it("returns 400 when search is missing", async () => {
		const res = await mockApi.get("/api/v1/search/chart-hash");

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.description).toContain("search");
	});

	it("returns 200 with an empty charts array when nothing matches", async () => {
		const res = await mockApi.get(
			"/api/v1/search/chart-hash?search=deadbeefdeadbeefdeadbeefdeadbeef",
		);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.charts).toEqual([]);
	});

	it("returns BMS charts matched by MD5", async () => {
		const n = ++seedCounter;
		const md5 = `a${n.toString(16).padStart(31, "0")}`.slice(0, 32);
		const sha256 = "b".repeat(64);
		const songNewID = `s_ch_hash_bms_${n}`;
		const chartPgId = `c_ch_hash_bms_${n}`;
		const legacySongId = 970_000 + n;

		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: legacySongId,
				game_group: "bms",
				title: "Chart Hash Search BMS",
				artist: "Test",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: {
					subtitle: null,
					subartist: null,
					genre: null,
					tableString: null,
				},
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPgId,
				legacy_id: chartPgId,
				game: "bms-7k",
				song_id: songNewID,
				level: "?",
				level_num: 0,
				is_primary: true,
				difficulty: "CHART",
				versions: [],
				data: {
					hashMD5: md5,
					hashSHA256: sha256,
					notecount: 1,
					tableFolders: {},
					aiLevel: null,
					sglEC: null,
					sglHC: null,
				},
			})
			.execute();

		const res = await mockApi.get(`/api/v1/search/chart-hash?search=${md5}`);

		expect(res.status).toBe(200);
		const charts = res.body.body.charts as Array<{ chartID: string; song: { id: string } }>;
		expect(charts).toHaveLength(1);
		expect(charts[0].chartID).toBe(chartPgId);
		expect(charts[0].song.id).toBe(songNewID);
	});

	it("returns PMS charts matched by SHA256", async () => {
		const n = ++seedCounter;
		const md5 = "c".repeat(32);
		const sha256 = `d${n.toString(16).padStart(63, "0")}`.slice(0, 64);
		const songNewID = `s_ch_hash_pms_${n}`;
		const chartPgId = `c_ch_hash_pms_${n}`;
		const legacySongId = 971_000 + n;

		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: legacySongId,
				game_group: "pms",
				title: "Chart Hash Search PMS",
				artist: "Test",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: {
					genre: null,
					subtitle: null,
					subartist: null,
					tableString: null,
				},
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPgId,
				legacy_id: chartPgId,
				game: "pms-keyboard",
				song_id: songNewID,
				level: "?",
				level_num: 0,
				is_primary: true,
				difficulty: "CHART",
				versions: [],
				data: {
					hashMD5: md5,
					hashSHA256: sha256,
					notecount: 1,
					tableFolders: {},
					sglEC: null,
					sglHC: null,
				},
			})
			.execute();

		const res = await mockApi.get(`/api/v1/search/chart-hash?search=${sha256}`);

		expect(res.status).toBe(200);
		const charts = res.body.body.charts as Array<{ chartID: string; song: { id: string } }>;
		expect(charts).toHaveLength(1);
		expect(charts[0].chartID).toBe(chartPgId);
		expect(charts[0].song.id).toBe(songNewID);
	});

	it("returns ITG charts matched by hashGSv3", async () => {
		const n = ++seedCounter;
		const gsv3 = `itg-gsv3-${n}`;
		const songNewID = `s_ch_hash_itg_${n}`;
		const chartPgId = `c_ch_hash_itg_${n}`;
		const legacySongId = 972_000 + n;

		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: legacySongId,
				game_group: "itg",
				title: "Chart Hash Search ITG",
				artist: "Test",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: { subtitle: null },
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPgId,
				legacy_id: chartPgId,
				game: "itg-stamina",
				song_id: songNewID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "10",
				versions: [],
				data: {
					hashGSv3: gsv3,
					chartLevel: 10,
					rankedLevel: null,
					difficultyTag: "Hard",
					length: 120,
					charter: "t",
					streamBPM: 150,
					breakdown: null,
					npsPerMeasure: [],
					notesPerMeasure: [],
					bannerLocationOverride: null,
					originalPack: "p",
					packs: [],
				},
			})
			.execute();

		const res = await mockApi.get(
			`/api/v1/search/chart-hash?search=${encodeURIComponent(gsv3)}`,
		);

		expect(res.status).toBe(200);
		const charts = res.body.body.charts as Array<{ chartID: string; song: { id: string } }>;
		expect(charts).toHaveLength(1);
		expect(charts[0].chartID).toBe(chartPgId);
		expect(charts[0].song.id).toBe(songNewID);
	});

	it("returns USC charts matched by hashSHA1", async () => {
		const n = ++seedCounter;
		const sha1 = `e${n.toString(16).padStart(39, "0")}`.slice(0, 40);
		const songNewID = `s_ch_hash_usc_${n}`;
		const chartPgId = `c_ch_hash_usc_${n}`;
		const legacySongId = 973_000 + n;

		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: legacySongId,
				game_group: "usc",
				title: "Chart Hash Search USC",
				artist: "Test",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: {},
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPgId,
				legacy_id: chartPgId,
				game: "usc-controller",
				song_id: songNewID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "10",
				versions: [],
				data: {
					hashSHA1: sha1,
					isOfficial: true,
					effector: "x",
					tableFolders: {},
				},
			})
			.execute();

		const res = await mockApi.get(`/api/v1/search/chart-hash?search=${sha1}`);

		expect(res.status).toBe(200);
		const charts = res.body.body.charts as Array<{ chartID: string; song: { id: string } }>;
		expect(charts).toHaveLength(1);
		expect(charts[0].chartID).toBe(chartPgId);
		expect(charts[0].song.id).toBe(songNewID);
	});
});
