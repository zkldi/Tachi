import { ONE_SECOND } from "#lib/constants/time";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_MarkAllNotificationsRead } from "./mark-all-notifications-read";
import { getNotification, seedNotification } from "./test-utils/notifications";

// ─── ACTION_MarkAllNotificationsRead ─────────────────────────────────────────

describe("ACTION_MarkAllNotificationsRead", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns { markedCount: 0 } when the user has no notifications", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_MarkAllNotificationsRead(taker, {});

		expect(result).toEqual({ markedCount: 0 });
	});

	it("returns the count of notifications that were marked", async () => {
		await seedNotification({ userId });
		await seedNotification({ userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_MarkAllNotificationsRead(taker, {});

		expect(result).toEqual({ markedCount: 2 });
	});

	it("marks unread notifications as read", async () => {
		const rowId = await seedNotification({ userId, read: false });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_MarkAllNotificationsRead(taker, {});

		const row = await getNotification(rowId);

		expect(row?.read).toBe(true);
	});

	it("leaves already-read notifications read", async () => {
		const rowId = await seedNotification({ userId, read: true });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_MarkAllNotificationsRead(taker, {});

		const row = await getNotification(rowId);

		expect(row?.read).toBe(true);
	});

	// ── Two-second cutoff ─────────────────────────────────────────────────────

	it("does not mark notifications sent within the last two seconds", async () => {
		// A notification sent just now (0ms ago) is within the cutoff.
		const rowId = await seedNotification({ userId, read: false, ageMs: 0 });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_MarkAllNotificationsRead(taker, {});

		const row = await getNotification(rowId);

		expect(row?.read).toBe(false);
		expect(result.markedCount).toBe(0);
	});

	it("marks notifications older than two seconds", async () => {
		const rowId = await seedNotification({ userId, read: false, ageMs: ONE_SECOND * 3 });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_MarkAllNotificationsRead(taker, {});

		const row = await getNotification(rowId);

		expect(row?.read).toBe(true);
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not mark other users' notifications as read", async () => {
		const other = await seedUser({ username: "other_user" });
		const rowId = await seedNotification({ userId: other.id, read: false });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_MarkAllNotificationsRead(taker, {});

		const row = await getNotification(rowId);

		expect(row?.read).toBe(false);
	});

	it("does not count other users' notifications in markedCount", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedNotification({ userId: other.id, read: false });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_MarkAllNotificationsRead(taker, {});

		expect(result.markedCount).toBe(0);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_MarkAllNotificationsRead(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "MARK_ALL_NOTIFICATIONS_READ")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "MARK_ALL_NOTIFICATIONS_READ",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
