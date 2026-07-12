import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UnfollowUser } from "./unfollow-user";

// ─── ACTION_UnfollowUser ──────────────────────────────────────────────────────

describe("ACTION_UnfollowUser", () => {
	let userId: number;
	let username: string;
	let targetId: number;
	let targetUsername: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "follower" }));
		({ id: targetId, username: targetUsername } = await seedUser({ username: "target" }));

		// Start each test with the follow relationship already in place.
		await DB.insertInto("account_following")
			.values({ user_id: userId, followee: targetId })
			.execute();
	});

	// ── Not-following guard ───────────────────────────────────────────────────

	it("throws 409 when the taker is not following the target", async () => {
		const { id: otherId } = await seedUser({ username: "unrelated" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UnfollowUser(taker, { userID: otherId })).rejects.toMatchObject({
			code: 409,
		});
	});

	it("throws 409 when the target follows the taker but not the other way around", async () => {
		// Seed the reverse follow (target → taker) only; taker does not follow target.
		const { id: thirdId, username: thirdUsername } = await seedUser({ username: "third_user" });

		await DB.insertInto("account_following")
			.values({ user_id: targetId, followee: thirdId })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: thirdId, username: thirdUsername } };

		await expect(ACTION_UnfollowUser(taker, { userID: targetId })).rejects.toMatchObject({
			code: 409,
		});
	});

	// ── Input validation ──────────────────────────────────────────────────────

	it("throws when userID is 0 (not a positive integer)", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UnfollowUser(taker, { userID: 0 })).rejects.toMatchObject({
			code: 400,
		});
	});

	it("throws when userID is negative", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UnfollowUser(taker, { userID: -1 })).rejects.toMatchObject({
			code: 400,
		});
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("removes the account_following row", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UnfollowUser(taker, { userID: targetId });

		const row = await DB.selectFrom("account_following")
			.select(["user_id", "followee"])
			.where("user_id", "=", userId)
			.where("followee", "=", targetId)
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});

	it("returns the target user's username", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UnfollowUser(taker, { userID: targetId });

		expect(result).toEqual({ username: targetUsername });
	});

	it("does not remove follow rows belonging to other users", async () => {
		const { id: otherId } = await seedUser({ username: "other_follower" });
		await DB.insertInto("account_following")
			.values({ user_id: otherId, followee: targetId })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UnfollowUser(taker, { userID: targetId });

		const preserved = await DB.selectFrom("account_following")
			.select(["user_id", "followee"])
			.where("user_id", "=", otherId)
			.where("followee", "=", targetId)
			.executeTakeFirst();

		expect(preserved).toBeDefined();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UnfollowUser(taker, { userID: targetId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UNFOLLOW_USER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UNFOLLOW_USER",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when the target is not being followed", async () => {
		const { id: otherId } = await seedUser({ username: "unrelated" });
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UnfollowUser(taker, { userID: otherId })).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "UNFOLLOW_USER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
