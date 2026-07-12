import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_SetUserSupporterStatus } from "./set-user-supporter-status";

// ─── ACTION_SetUserSupporterStatus ─────────────────────────────────────────────

describe("ACTION_SetUserSupporterStatus", () => {
	let adminId: number;
	let adminUsername: string;
	let targetId: number;

	beforeEach(async () => {
		({ id: adminId, username: adminUsername } = await seedUser({
			username: "sup_admin",
			authLevel: "admin",
		}));
		({ id: targetId } = await seedUser({ username: "sup_target" }));
	});

	function adminTaker(ip = "127.0.0.1") {
		return { ip, acct: { id: adminId, username: adminUsername } };
	}

	// ── Input validation (Zod, before action body) ─────────────────────────────

	it("throws when userID is 0 (not a positive integer)", async () => {
		await expect(
			ACTION_SetUserSupporterStatus(adminTaker(), { userID: 0, isSupporter: true }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws when userID is negative", async () => {
		await expect(
			ACTION_SetUserSupporterStatus(adminTaker(), { userID: -1, isSupporter: true }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when input fails Zod validation", async () => {
		await expect(
			ACTION_SetUserSupporterStatus(adminTaker("9.9.9.9"), { userID: 0, isSupporter: true }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select(["result", "kind", "ip"])
			.where("kind", "=", "SET_USER_SUPPORTER_STATUS")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "SET_USER_SUPPORTER_STATUS",
			result: "BAD",
			ip: "9.9.9.9",
		});
	});

	// ── Authorization ─────────────────────────────────────────────────────────

	it("throws 403 when requester is not admin", async () => {
		const { id: nonAdminId, username: nonAdminName } = await seedUser({
			username: "sup_nonadmin",
		});
		const taker = { ip: "127.0.0.1", acct: { id: nonAdminId, username: nonAdminName } };

		await expect(
			ACTION_SetUserSupporterStatus(taker, { userID: targetId, isSupporter: true }),
		).rejects.toMatchObject({
			code: 403,
			reason: "You are not authorized to perform this action.",
		});
	});

	it("writes a BAD action row when requester is not admin", async () => {
		const { id: nonAdminId, username: nonAdminName } = await seedUser({
			username: "sup_nonadmin2",
		});
		const taker = { ip: "10.0.0.2", acct: { id: nonAdminId, username: nonAdminName } };

		await expect(
			ACTION_SetUserSupporterStatus(taker, { userID: targetId, isSupporter: true }),
		).rejects.toMatchObject({ code: 403 });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "SET_USER_SUPPORTER_STATUS")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "SET_USER_SUPPORTER_STATUS",
			result: "BAD",
			ip: "10.0.0.2",
			user_id: nonAdminId,
		});
	});

	// ── Target user missing ─────────────────────────────────────────────────────

	it("throws 404 when target user does not exist", async () => {
		await expect(
			ACTION_SetUserSupporterStatus(adminTaker(), { userID: 999_999_999, isSupporter: true }),
		).rejects.toMatchObject({
			code: 404,
			reason: "This user does not exist.",
		});
	});

	it("writes a BAD action row when target user does not exist", async () => {
		await expect(
			ACTION_SetUserSupporterStatus(adminTaker("10.0.0.3"), {
				userID: 999_999_998,
				isSupporter: true,
			}),
		).rejects.toMatchObject({ code: 404 });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "SET_USER_SUPPORTER_STATUS")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "SET_USER_SUPPORTER_STATUS",
			result: "BAD",
			ip: "10.0.0.3",
			user_id: adminId,
		});
	});

	// ── Happy path ──────────────────────────────────────────────────────────────

	it("returns {} on success", async () => {
		const result = await ACTION_SetUserSupporterStatus(adminTaker(), {
			userID: targetId,
			isSupporter: true,
		});

		expect(result).toEqual({});
	});

	it("sets is_supporter to true on the account", async () => {
		await ACTION_SetUserSupporterStatus(adminTaker(), { userID: targetId, isSupporter: true });

		const row = await DB.selectFrom("account")
			.select("is_supporter")
			.where("id", "=", targetId)
			.executeTakeFirstOrThrow();

		expect(row.is_supporter).toBe(true);
	});

	it("sets is_supporter to false on the account", async () => {
		await DB.updateTable("account")
			.set({ is_supporter: true })
			.where("id", "=", targetId)
			.execute();

		await ACTION_SetUserSupporterStatus(adminTaker(), { userID: targetId, isSupporter: false });

		const row = await DB.selectFrom("account")
			.select("is_supporter")
			.where("id", "=", targetId)
			.executeTakeFirstOrThrow();

		expect(row.is_supporter).toBe(false);
	});

	it("writes a GOOD action row on success", async () => {
		await ACTION_SetUserSupporterStatus(adminTaker("10.0.0.4"), {
			userID: targetId,
			isSupporter: true,
		});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "SET_USER_SUPPORTER_STATUS")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "SET_USER_SUPPORTER_STATUS",
			result: "GOOD",
			ip: "10.0.0.4",
			user_id: adminId,
		});
	});
});
