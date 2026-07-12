import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_FollowUser } from "./follow-user";

// ─── ACTION_FollowUser ────────────────────────────────────────────────────────

describe("ACTION_FollowUser", () => {
	let userId: number;
	let username: string;
	let targetId: number;
	let targetUsername: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "follower" }));
		({ id: targetId, username: targetUsername } = await seedUser({ username: "target" }));
	});

	// ── Input validation ──────────────────────────────────────────────────────

	it("throws when userID is 0 (not a positive integer)", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: 0 })).rejects.toMatchObject({ code: 400 });
	});

	it("throws when userID is negative", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: -1 })).rejects.toMatchObject({ code: 400 });
	});

	// ── Self-follow guard ─────────────────────────────────────────────────────

	it("throws 400 when the taker tries to follow themselves", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: userId })).rejects.toMatchObject({
			code: 400,
		});
	});

	// ── Already-following guard ───────────────────────────────────────────────

	it("throws 409 when the taker is already following the target", async () => {
		await DB.insertInto("account_following")
			.values({ user_id: userId, followee: targetId })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: targetId })).rejects.toMatchObject({
			code: 409,
		});
	});

	// ── Max-following cap ─────────────────────────────────────────────────────

	it("throws 400 when the taker has reached MAX_FOLLOWING_AMOUNT", async () => {
		// Temporarily lower the cap so we don't need to seed thousands of users.
		const originalMax = ServerConfig.MAX_FOLLOWING_AMOUNT;

		try {
			ServerConfig.MAX_FOLLOWING_AMOUNT = 1;

			// Seed one real follow so the count equals the new cap.
			await DB.insertInto("account_following")
				.values({ user_id: userId, followee: targetId })
				.execute();

			const { id: otherId } = await seedUser({ username: "third_user" });
			const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

			await expect(ACTION_FollowUser(taker, { userID: otherId })).rejects.toMatchObject({
				code: 400,
			});
		} finally {
			ServerConfig.MAX_FOLLOWING_AMOUNT = originalMax;
		}
	});

	// ── Target user not found ─────────────────────────────────────────────────

	it("throws 400 when the target user does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: 99999 })).rejects.toMatchObject({
			code: 400,
		});
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("inserts a row into account_following", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_FollowUser(taker, { userID: targetId });

		const row = await DB.selectFrom("account_following")
			.select(["user_id", "followee"])
			.where("user_id", "=", userId)
			.where("followee", "=", targetId)
			.executeTakeFirst();

		expect(row).toBeDefined();
		expect(row?.user_id).toBe(userId);
		expect(row?.followee).toBe(targetId);
	});

	it("returns the target user's username", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_FollowUser(taker, { userID: targetId });

		expect(result).toEqual({ username: targetUsername });
	});

	it("does not create a follow row for the target user's other followers", async () => {
		const { id: otherId } = await seedUser({ username: "other_follower" });
		await DB.insertInto("account_following")
			.values({ user_id: otherId, followee: targetId })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_FollowUser(taker, { userID: targetId });

		const rows = await DB.selectFrom("account_following")
			.select(["user_id", "followee"])
			.where("followee", "=", targetId)
			.execute();

		expect(rows).toHaveLength(2);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_FollowUser(taker, { userID: targetId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "FOLLOW_USER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "FOLLOW_USER",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when the target user does not exist", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_FollowUser(taker, { userID: 99999 })).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "FOLLOW_USER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
