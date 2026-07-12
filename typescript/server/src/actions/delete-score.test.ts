import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { type ScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

import { ACTION_DeleteScore } from "./delete-score";

describe("ACTION_DeleteScore", () => {
	let counter = 0;

	async function seedIidxScore(userId: number) {
		const n = ++counter;
		const songId = `song-ds-${n}`;
		const chartId = `chart-ds-${n}`;
		const scoreId = `score-ds-${n}`;
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 700_000 + n,
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

		return scoreId;
	}

	it("throws 404 when the score does not exist", async () => {
		const { id: userId, username } = await seedUser({ username: "ds_owner_404" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_DeleteScore(taker, { id: "no-such-score" })).rejects.toMatchObject({
			code: 404,
		});
	});

	it("throws 403 when the score belongs to another user", async () => {
		const { id: ownerId } = await seedUser({ username: "ds_owner" });
		const { id: otherId, username: otherName } = await seedUser({ username: "ds_other" });
		const scoreId = await seedIidxScore(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherName } };

		await expect(ACTION_DeleteScore(taker, { id: scoreId })).rejects.toMatchObject({
			code: 403,
		});
	});

	it("allows an admin to delete another users score", async () => {
		const { id: ownerId } = await seedUser({ username: "ds_victim" });
		const { id: adminId, username: adminName } = await seedUser({
			username: "ds_admin",
			authLevel: "admin",
		});
		const scoreId = await seedIidxScore(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: adminId, username: adminName } };

		await ACTION_DeleteScore(taker, { id: scoreId });

		const row = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("removes the score for the owner", async () => {
		const { id: userId, username } = await seedUser({ username: "ds_ok" });
		const scoreId = await seedIidxScore(userId);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteScore(taker, { id: scoreId });

		const row = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("writes a GOOD action row on success", async () => {
		const { id: userId, username } = await seedUser({ username: "ds_audit" });
		const scoreId = await seedIidxScore(userId);
		const taker = { ip: "10.0.0.2", acct: { id: userId, username } };

		await ACTION_DeleteScore(taker, { id: scoreId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_SCORE")
			.orderBy("ts_end", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_SCORE",
			result: "GOOD",
			ip: "10.0.0.2",
			user_id: userId,
		});
	});
});
