import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingBMS7KScore } from "#test-utils/test-data";
import { type ScoreData } from "tachi-common";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

let seedCounter = 0;

async function seedBmsChartWithHashes(opts: {
	game: "bms-7k" | "bms-14k";
	md5: string;
	sha256: string;
}) {
	const n = ++seedCounter;
	const songNewID = `s_bms_router_${n}`;
	const chartPgId = `c_bms_router_${n}`;

	await DB.insertInto("song")
		.values({
			id: songNewID,
			legacy_id: 960_000 + n,
			game_group: "bms",
			title: "BMS Router Test",
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
			game: opts.game,
			song_id: songNewID,
			level: "?",
			level_num: 0,
			is_primary: true,
			difficulty: "CHART",
			versions: [],
			data: {
				hashMD5: opts.md5,
				hashSHA256: opts.sha256,
				notecount: 1,
				tableFolders: {},
				aiLevel: null,
				sglEC: null,
				sglHC: null,
			},
		})
		.execute();

	return { chartPgId, songNewID };
}

async function insertBmsPb(userId: number, chartPgId: string) {
	const { data, derived, judgements } = mongoScoreDataToPg(
		"bms-7k",
		TestingBMS7KScore.scoreData as ScoreData<"bms-7k">,
	);

	const now = new Date().toISOString();

	await DB.insertInto("pb")
		.values({
			user_id: userId,
			chart_id: chartPgId,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			calculated_data: JSON.stringify({}),
			judgements: JSON.stringify(judgements),
			ranking_value: 100,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: now,
		})
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/custom-tables/:tableUrlName", () => {
	it("returns HTML with a bmstable meta header for user-specific tables", async () => {
		const { id } = await seedUser({ username: "bms_custom_tbl" });

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/bms-7k/custom-tables/rival-info`,
		);

		expect(res.status).toBe(200);
		expect(res.text).toContain('meta name="bmstable"');
		expect(res.text).toContain(
			`https://example.com/api/v1/users/${id}/games/bms-7k/custom-tables/rival-info/header.json`,
		);
	});

	it("returns 404 when fetching a public table from the user route", async () => {
		const { id } = await seedUser({ username: "bms_custom_tbl_pub" });

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/bms-7k/custom-tables/sieglindeEC`,
		);

		expect(res.status).toBe(404);
		expect(res.body.description).toContain("user specific");
	});
});

describe("GET /api/v1/users/:userID/games/:game/best-score/:checksum", () => {
	const md5 = "a1b2c3d4e5f6789012345678abcdef01";
	const sha256 = "b".repeat(64);

	it("returns 400 for a non-hex checksum", async () => {
		const { id } = await seedUser({ username: "bms_bs_hex" });

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/bms-7k/best-score/gggggggggggggggggggggggggggggg`,
		);

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.description).toContain("Invalid checksum");
	});

	it("returns 400 for an invalid checksum length", async () => {
		const { id } = await seedUser({ username: "bms_bs_len" });

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/bms-7k/best-score/${"f".repeat(31)}`,
		);

		expect(res.status).toBe(400);
		expect(res.body.description).toContain("length");
	});

	it("returns 400 for an invalid game", async () => {
		const { id } = await seedUser({ username: "bms_bs_pt" });

		const res = await mockApi.get(`/api/v1/users/${id}/games/bms-99k/best-score/${md5}`);

		expect(res.status).toBe(400);
		expect(res.body.description).toContain("game");
	});

	it("returns 404 when no chart matches the checksum for this game", async () => {
		const { id } = await seedUser({ username: "bms_bs_missing" });

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/bms-7k/best-score/${"e".repeat(32)}`,
		);

		expect(res.status).toBe(404);
		expect(res.body.description).toContain("No chart found");
	});

	it("returns 404 when the chart exists for the other BMS game", async () => {
		const { id } = await seedUser({ username: "bms_bs_wrongpt" });
		await seedBmsChartWithHashes({ md5, sha256, game: "bms-7k" });

		const res = await mockApi.get(`/api/v1/users/${id}/games/bms-14k/best-score/${md5}`);

		expect(res.status).toBe(404);
		expect(res.body.description).toContain("No chart found");
	});

	it("lowercase-checksums match chart hashes (MD5), and returns PB when present", async () => {
		const { id } = await seedUser({ username: "bms_bs_md5" });
		const upperMd5 = md5.toUpperCase();
		const { chartPgId } = await seedBmsChartWithHashes({ md5, sha256, game: "bms-7k" });

		const res = await mockApi.get(`/api/v1/users/${id}/games/bms-7k/best-score/${upperMd5}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.description).toBe("Player has not played this chart.");
		expect(res.body.body).toBeNull();

		await insertBmsPb(id, chartPgId);

		const res2 = await mockApi.get(`/api/v1/users/${id}/games/bms-7k/best-score/${md5}`);

		expect(res2.status).toBe(200);
		expect(res2.body.description).toBe("Best score found.");
		expect(res2.body.body).not.toBeNull();
		expect(res2.body.body.chartID).toBe(chartPgId);
		expect(res2.body.body.userID).toBe(id);
	});

	it("matches SHA256 when the checksum is 64 hex chars", async () => {
		const { id } = await seedUser({ username: "bms_bs_sha256" });
		await seedBmsChartWithHashes({ md5, sha256, game: "bms-7k" });

		const res = await mockApi.get(`/api/v1/users/${id}/games/bms-7k/best-score/${sha256}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toBeNull();
	});
});
