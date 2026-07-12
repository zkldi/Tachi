import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { type ScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

import { ACTION_DeleteSession } from "./delete-session";

describe("ACTION_DeleteSession", () => {
	let counter = 0;

	async function seedSessionWithOneScore(userId: number) {
		const n = ++counter;
		const sessionId = `Q${n.toString(16).padStart(40, "0").slice(0, 40)}`;
		const songId = `song-dsess-${n}`;
		const chartId = `chart-dsess-${n}`;
		const scoreId = `score-dsess-${n}`;
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 800_000 + n,
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

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "Seed",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: sessionId,
				import_id: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: now,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();

		return { sessionId, scoreId };
	}

	it("throws 404 when the session does not exist", async () => {
		const { id: userId, username } = await seedUser({ username: "dse_404" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_DeleteSession(taker, { id: "no-such-session" })).rejects.toMatchObject({
			code: 404,
		});
	});

	it("throws 403 when the session belongs to another user", async () => {
		const { id: ownerId } = await seedUser({ username: "dse_owner" });
		const { id: otherId, username: otherName } = await seedUser({ username: "dse_intruder" });
		const { sessionId } = await seedSessionWithOneScore(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherName } };

		await expect(ACTION_DeleteSession(taker, { id: sessionId })).rejects.toMatchObject({
			code: 403,
		});
	});

	it("allows an admin to delete another users session", async () => {
		const { id: ownerId } = await seedUser({ username: "dse_victim" });
		const { id: adminId, username: adminName } = await seedUser({
			username: "dse_admin",
			authLevel: "admin",
		});
		const { sessionId, scoreId } = await seedSessionWithOneScore(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: adminId, username: adminName } };

		await ACTION_DeleteSession(taker, { id: sessionId });

		const sess = await DB.selectFrom("session")
			.select("id")
			.where("id", "=", sessionId)
			.executeTakeFirst();
		const score = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();

		expect(sess).toBeUndefined();
		expect(score).toBeUndefined();
	});

	it("removes the session and its scores for the owner", async () => {
		const { id: userId, username } = await seedUser({ username: "dse_ok" });
		const { sessionId, scoreId } = await seedSessionWithOneScore(userId);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteSession(taker, { id: sessionId });

		const sess = await DB.selectFrom("session")
			.select("id")
			.where("id", "=", sessionId)
			.executeTakeFirst();
		const score = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();

		expect(sess).toBeUndefined();
		expect(score).toBeUndefined();
	});

	it("writes a GOOD action row on success", async () => {
		const { id: userId, username } = await seedUser({ username: "dse_audit" });
		const { sessionId } = await seedSessionWithOneScore(userId);
		const taker = { ip: "10.0.0.3", acct: { id: userId, username } };

		await ACTION_DeleteSession(taker, { id: sessionId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_SESSION")
			.orderBy("ts_end", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_SESSION",
			result: "GOOD",
			ip: "10.0.0.3",
			user_id: userId,
		});
	});
});
