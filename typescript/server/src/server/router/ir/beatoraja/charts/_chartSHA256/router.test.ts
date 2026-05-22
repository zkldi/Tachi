import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { BMSGazerChart, BMSGazerSong } from "#test-utils/test-data";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const GAZER_SHA256 = "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d";
const GAZER_CHARTID = "88eb6cc5683e2740cbd07f588a5f3db1db8d467b";

afterAll(() => CloseServerConnection());

async function seedGazer() {
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

describe("GET /ir/beatoraja/charts/:chartSHA256/scores (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({ username: "bms_ir_u", email: "beatoraja-ir@example.com" });
		await seedApiToken({
			token: "mock_token",
			userId: 1,
			submitScore: true,
		});
		await seedGazer();

		const sd = {
			score: 1234,
			enumIndexes: { lamp: 4 },
			optional: { enumIndexes: {} },
			judgements: {},
		};
		const { data, derived, judgements } = mongoScoreDataToPg("bms-7k", sd as never);

		await DB.insertInto("pb")
			.values({
				user_id: 1,
				chart_id: GAZER_CHARTID,
				lens: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify({}),
				ranking_value: 1234,
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
				id: "mock_lampPB",
				user_id: 1,
				chart_id: GAZER_CHARTID,
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
	});

	it("returns PB-derived scores for the chart", async () => {
		const res = await mockApi
			.get(`/ir/beatoraja/charts/${GAZER_SHA256}/scores`)
			.set("Authorization", "Bearer mock_token")
			.set("X-TachiIR-Version", "v2.0.0");

		expect(res.status).toBe(200);
		expect(res.body.body[0]).toMatchObject({
			epg: 617,
			lpg: 0,
			player: "",
			playcount: 0,
		});
	});

	it("returns 404 when the chart hash is unknown", async () => {
		const res = await mockApi
			.get("/ir/beatoraja/charts/INVALID/scores")
			.set("Authorization", "Bearer mock_token")
			.set("X-TachiIR-Version", "v2.0.0");

		expect(res.status).toBe(404);
	});
});
