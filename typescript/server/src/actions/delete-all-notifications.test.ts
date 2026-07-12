import { ONE_SECOND } from "#lib/constants/time";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_DeleteAllNotifications } from "./delete-all-notifications";
import {
	countNotificationsForUser,
	getNotification,
	seedNotification,
} from "./test-utils/notifications";

// ─── ACTION_DeleteAllNotifications ───────────────────────────────────────────

describe("ACTION_DeleteAllNotifications", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns { deletedCount: 0 } when the user has no notifications", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteAllNotifications(taker, {});

		expect(result).toEqual({ deletedCount: 0 });
	});

	it("returns the count of deleted notifications", async () => {
		await seedNotification({ userId });
		await seedNotification({ userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteAllNotifications(taker, {});

		expect(result).toEqual({ deletedCount: 2 });
	});

	it("removes the notifications from the DB", async () => {
		await seedNotification({ userId });
		await seedNotification({ userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteAllNotifications(taker, {});

		expect(await countNotificationsForUser(userId)).toBe(0);
	});

	it("deletes both read and unread notifications", async () => {
		await seedNotification({ userId, read: false });
		await seedNotification({ userId, read: true });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteAllNotifications(taker, {});

		expect(await countNotificationsForUser(userId)).toBe(0);
	});

	// ── Two-second cutoff ─────────────────────────────────────────────────────

	it("does not delete notifications sent within the last two seconds", async () => {
		const rowId = await seedNotification({ userId, ageMs: 0 });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteAllNotifications(taker, {});

		expect(await getNotification(rowId)).toBeDefined();
		expect(result.deletedCount).toBe(0);
	});

	it("deletes notifications older than two seconds", async () => {
		const rowId = await seedNotification({ userId, ageMs: ONE_SECOND * 3 });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteAllNotifications(taker, {});

		expect(await getNotification(rowId)).toBeUndefined();
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not delete other users' notifications", async () => {
		const other = await seedUser({ username: "other_user" });
		const rowId = await seedNotification({ userId: other.id });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteAllNotifications(taker, {});

		expect(await getNotification(rowId)).toBeDefined();
	});

	it("does not count other users' notifications in deletedCount", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedNotification({ userId: other.id });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteAllNotifications(taker, {});

		expect(result.deletedCount).toBe(0);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteAllNotifications(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_ALL_NOTIFICATIONS")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_ALL_NOTIFICATIONS",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
