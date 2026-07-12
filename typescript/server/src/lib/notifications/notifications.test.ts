import { SELECT_NOTIFICATION } from "#lib/db-formats/notification";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { BulkSendNotification, SendNotification } from "./notifications";

describe("SendNotification", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({ username: "notif_send_user" }));
	});

	it("inserts a notification row with expected kind and payload", async () => {
		await SendNotification("Quest updated", userId, {
			type: "QUEST_CHANGED",
			content: { questID: "q1", game: "iidx-sp" },
		});

		const row = await DB.selectFrom("notification")
			.select(SELECT_NOTIFICATION)
			.where("notification.sent_to", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.title).toBe("Quest updated");
		expect(row.read).toBe(false);
		expect(row.kind).toBe("quest_changed");
		expect(row.payload).toEqual({
			type: "QUEST_CHANGED",
			content: { questID: "q1", game: "iidx-sp" },
		});
	});

	it("inserts ORPHANS_RESTORED with scoreCount payload", async () => {
		await SendNotification("3 orphan scores were restored", userId, {
			type: "ORPHANS_RESTORED",
			content: { scoreCount: 3 },
		});

		const row = await DB.selectFrom("notification")
			.select(SELECT_NOTIFICATION)
			.where("notification.sent_to", "=", userId)
			.where("notification.kind", "=", "orphans_restored")
			.executeTakeFirstOrThrow();

		expect(row.title).toBe("3 orphan scores were restored");
		expect(row.payload).toEqual({
			type: "ORPHANS_RESTORED",
			content: { scoreCount: 3 },
		});
	});
});

describe("BulkSendNotification", () => {
	let userId1: number;
	let userId2: number;

	beforeEach(async () => {
		({ id: userId1 } = await seedUser({ username: "notif_bulk_a" }));
		({ id: userId2 } = await seedUser({ username: "notif_bulk_b" }));
	});

	it("inserts one row per recipient", async () => {
		await BulkSendNotification("Announcement", [userId1, userId2], {
			type: "SITE_ANNOUNCEMENT",
			content: {},
		});

		const rows = await DB.selectFrom("notification")
			.select(["sent_to", "kind", "title"])
			.where("sent_to", "in", [userId1, userId2])
			.execute();

		expect(rows).toHaveLength(2);
		expect(
			rows.every((r) => r.kind === "site_announcement" && r.title === "Announcement"),
		).toBe(true);
	});

	it("does nothing when the recipient list is empty", async () => {
		await BulkSendNotification("noop", [], {
			type: "SITE_ANNOUNCEMENT",
			content: {},
		});

		const rows = await DB.selectFrom("notification").select("row_id").execute();

		expect(rows.length).toBe(0);
	});
});
