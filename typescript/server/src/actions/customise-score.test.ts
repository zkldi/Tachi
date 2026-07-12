import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { mongoScoreDataToPg, pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { type ScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

import { ACTION_CustomiseScore } from "./customise-score";

// ─── mergeScoreDataFromPg roundtrip ───────────────────────────────────────────

describe("mergeScoreDataFromPg", () => {
	it("inverts mongoScoreDataToPg for iidx:SP", () => {
		const original = {
			grade: "F",
			lamp: "FAILED",
			percent: 50,
			score: 200,
			optional: {},
		} as ScoreData<"iidx-sp">;

		const pg = mongoScoreDataToPg("iidx-sp", { ...original, judgements: {} });
		const back = pgScoreDataToAPI("iidx-sp", pg);

		expect(back).toMatchObject({
			grade: "F",
			lamp: "FAILED",
			percent: 50,
			score: 200,
		});
	});
});

// ─── ACTION_CustomiseScore ────────────────────────────────────────────────────

describe("ACTION_CustomiseScore", () => {
	let counter = 0;

	async function seedIidxScore(userId: number) {
		const n = ++counter;
		const songId = `song-cs-${n}`;
		const chartId = `chart-cs-${n}`;
		const scoreId = `score-cs-${n}`;
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: n,
				game_group: "iidx",
				title: "S",
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
				game: "iidx-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
			grade: "F",
			lamp: "FAILED",
			percent: 0,
			score: 100,
			optional: {},
			judgements: {},
		} as ScoreData<"iidx-sp">);

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: null,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();

		return { scoreId, chartId };
	}

	it("updates comment and returns the score document", async () => {
		const { id: userId, username } = await seedUser();
		const { scoreId } = await seedIidxScore(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_CustomiseScore(taker, {
			scoreID: scoreId,
			comment: "nice",
		});

		const score = await LoadScoreDocumentById(scoreId);

		expect(score?.comment).toBe("nice");
	});

	it("updates highlight and propagates to pb when present", async () => {
		const { id: userId, username } = await seedUser();
		const { scoreId, chartId } = await seedIidxScore(userId);

		await DB.insertInto("pb")
			.values({
				user_id: userId,
				chart_id: chartId,
				lens: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
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

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_CustomiseScore(taker, {
			scoreID: scoreId,
			highlight: true,
		});

		const [scoreRow, pbRow] = await Promise.all([
			DB.selectFrom("score").select("highlight").where("id", "=", scoreId).executeTakeFirst(),
			DB.selectFrom("pb")
				.select("highlight")
				.where("user_id", "=", userId)
				.where("chart_id", "=", chartId)
				.executeTakeFirst(),
		]);

		expect(scoreRow?.highlight).toBe(true);
		expect(pbRow?.highlight).toBe(true);
	});

	it("throws 400 when nothing to change", async () => {
		const { id: userId, username } = await seedUser();
		const { scoreId } = await seedIidxScore(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_CustomiseScore(taker, { scoreID: scoreId })).rejects.toMatchObject({
			code: 400,
		});
	});
});
