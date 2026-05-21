import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import {
	BMSGazerChart,
	BMSGazerSong,
	MockBeatorajaBMSScore,
	MockBeatorajaPMSScore,
} from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const NEW_SHA256 = "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732";
const NEW_MD5 = "d0f497c0f955e7edfb0278f446cdb6f8";
let seedCounter = 0;

const IR_HEADERS = {
	"X-TachiIR-Version": "v2.0.0",
} as const;

afterAll(() => CloseServerConnection());

async function seedPmsGazerController() {
	const songId = "s_pms_gazer";
	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 1,
			game_group: "pms",
			title: "GPMSAZER [MANIAQ]",
			artist: "Rocky",
			search_terms: [],
			alt_titles: [],
			data: {},
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: "0446f1b54e90d631ff9fe98419ebaea9481fab1f",
			legacy_id: "0446f1b54e90d631ff9fe98419ebaea9481fab1f",
			game: "pms-controller",
			song_id: songId,
			difficulty: "CHART",
			level: "?",
			level_num: 0,
			is_primary: true,
			versions: [],
			data: {
				hashMD5: "d1253dd56bb2087d0b0d474f0d562aae",
				hashSHA256: "a10193f7ae05ce839292dc716f182fda0b1cc6ac5382c2056f37e22ffba87b7d",
				notecount: 568,
				tableFolders: {},
			},
		})
		.execute();
}

async function seedBmsGazer() {
	await DB.insertInto("song")
		.values({
			id: BMSGazerSong.id,
			legacy_id: 27_339,
			game_group: "bms",
			title: BMSGazerSong.title,
			artist: BMSGazerSong.artist,
			search_terms: BMSGazerSong.searchTerms,
			alt_titles: BMSGazerSong.altTitles,
			data: BMSGazerSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: BMSGazerChart.chartID,
			legacy_id: BMSGazerChart.chartID,
			game: "bms-7k",
			song_id: BMSGazerSong.id,
			difficulty: BMSGazerChart.difficulty,
			level: BMSGazerChart.level,
			level_num: BMSGazerChart.levelNum,
			is_primary: BMSGazerChart.isPrimary,
			versions: BMSGazerChart.versions,
			data: BMSGazerChart.data,
		})
		.execute();
}

async function seedBmsProfile(userID: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userID,
			game: "bms-7k",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
			...newGameProfilePreferenceColumns("bms-7k"),
		})
		.execute();
}

async function seedBeatorajaPb(userID: number, score = 1234) {
	const sd = {
		score,
		enumIndexes: { lamp: 4 },
		optional: { enumIndexes: {}, bp: 12, gauge: 80, maxCombo: 321 },
		judgements: {},
	};
	const { data, derived, judgements } = mongoScoreDataToPg("bms-7k", sd as never);
	const n = ++seedCounter;

	await DB.insertInto("pb")
		.values({
			user_id: userID,
			chart_id: BMSGazerChart.chartID,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			ranking_value: score,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: null,
		})
		.execute();

	await DB.insertInto("score")
		.values({
			id: `beatoraja_route_score_${n}`,
			user_id: userID,
			chart_id: BMSGazerChart.chartID,
			game: "bms-7k",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({ inputDevice: "BM_CONTROLLER", random: "MIRROR" }),
			time_achieved: null,
			time_added: new Date().toISOString(),
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("POST /ir/beatoraja/submit-score (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "beatoraja-score@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "mock_token",
			userId: 1,
			submitScore: true,
		});
		await seedBmsGazer();
		await seedPmsGazerController();
	});

	it("imports a valid BMS score", async () => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token")
			.send(MockBeatorajaBMSScore);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		const body = res.body.body as {
			chart: { chartID: string };
			score: { game: string; importType: string | null; scoreData: { score: number } };
			song: { id: string };
		};
		expect(body.score.game).toBe("bms-7k");
		expect(body.score.scoreData.score).toBe(1004);
		expect(body.score.importType).toBe("ir/beatoraja");
		expect(body.chart.chartID).toBe(BMSGazerChart.chartID);
		expect(body.song.id).toBe("s27339");

		const scoreId = res.body.body.score.scoreID as string;
		const row = await DB.selectFrom("score")
			.selectAll()
			.where("id", "=", scoreId)
			.executeTakeFirst();

		expect(row).toBeDefined();
	});

	it("imports a valid PMS score", async () => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token")
			.send(MockBeatorajaPMSScore);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body?.score?.game).toBe("pms-controller");
	});

	it("returns 400 for unsupported clients", async () => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaBMSScore, { client: "INVALID" }));

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("orphans unknown charts (202)", async () => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(MockBeatorajaBMSScore, {
					chart: { sha256: NEW_SHA256, md5: NEW_MD5 },
					score: { sha256: NEW_SHA256, md5: NEW_MD5 },
				}),
			);

		expect(res.status).toBe(202);
		expect(String(res.body.description)).toMatch(/orphan/iu);

		const o = await DB.selectFrom("orphan_chart")
			.select("id")
			.where(sql`(orphan_chart.chart_doc::jsonb->'data'->>'hashSHA256')`, "=", NEW_SHA256)
			.executeTakeFirst();

		expect(o).toBeDefined();
	});

	it("requires authentication", async () => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set(IR_HEADERS)
			.send(MockBeatorajaBMSScore);

		expect(res.status).toBe(401);
	});
});

describe("GET /ir/beatoraja/rivals and /players/:userID/scores (Postgres)", () => {
	beforeEach(async () => {
		await seedBmsGazer();
	});

	it("returns Beatoraja-shaped rivals across supported games", async () => {
		const { id: mainId } = await seedUser({ username: "beatoraja_rivals_main" });
		const { id: rivalId } = await seedUser({ username: "beatoraja_rivals_rival" });
		await seedBmsProfile(mainId);
		await seedBmsProfile(rivalId);
		await seedApiToken({
			token: "mock_token",
			userId: mainId,
			submitScore: true,
		});

		await DB.insertInto("game_rival")
			.values({ user_id: mainId, game: "bms-7k", rival: rivalId })
			.execute();

		const res = await mockApi
			.get("/ir/beatoraja/rivals")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token");

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual([
			{
				id: `${rivalId}`,
				name: "beatoraja_rivals_rival",
				rank: "",
			},
		]);
	});

	it("exports a user's PBs as Beatoraja scores", async () => {
		const { id: mainId } = await seedUser({ username: "beatoraja_scores_main" });
		await seedBmsProfile(mainId);
		await seedApiToken({
			token: "mock_token",
			userId: mainId,
			submitScore: true,
		});
		await seedBeatorajaPb(mainId);

		const res = await mockApi
			.get(`/ir/beatoraja/players/${mainId}/scores`)
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token");

		expect(res.status).toBe(200);
		expect(res.body.body[0]).toMatchObject({
			sha256: BMSGazerChart.data.hashSHA256,
			player: "",
			playcount: 0,
			minbp: 12,
			gauge: 80,
			maxcombo: 321,
		});
	});

	it("allows exporting a configured rival's PBs by username", async () => {
		const { id: mainId } = await seedUser({ username: "beatoraja_rival_scores_main" });
		const { id: rivalId } = await seedUser({ username: "beatoraja_rival_scores_rival" });
		await seedBmsProfile(mainId);
		await seedBmsProfile(rivalId);
		await seedApiToken({
			token: "mock_token",
			userId: mainId,
			submitScore: true,
		});
		await DB.insertInto("game_rival")
			.values({ user_id: mainId, game: "bms-7k", rival: rivalId })
			.execute();
		await seedBeatorajaPb(rivalId);

		const res = await mockApi
			.get("/ir/beatoraja/players/beatoraja_rival_scores_rival/scores")
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token");

		expect(res.status).toBe(200);
		expect(res.body.body[0]).toMatchObject({
			player: "beatoraja_rival_scores_rival",
			playcount: 0,
		});
	});

	it("rejects exporting unrelated players", async () => {
		const { id: mainId } = await seedUser({ username: "beatoraja_unrelated_main" });
		const { id: otherId } = await seedUser({ username: "beatoraja_unrelated_other" });
		await seedBmsProfile(mainId);
		await seedApiToken({
			token: "mock_token",
			userId: mainId,
			submitScore: true,
		});

		const res = await mockApi
			.get(`/ir/beatoraja/players/${otherId}/scores`)
			.set(IR_HEADERS)
			.set("Authorization", "Bearer mock_token");

		expect(res.status).toBe(403);
	});
});
