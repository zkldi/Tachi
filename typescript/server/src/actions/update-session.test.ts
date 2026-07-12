import { LoadSessionDocumentById } from "#lib/db-formats/session";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { ACTION_UpdateSession } from "./update-session";

describe("ACTION_UpdateSession", () => {
	it("throws 400 when nothing to update", async () => {
		const { id: userId, username } = await seedUser();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateSession(taker, { sessionID: "missing" })).rejects.toMatchObject({
			code: 400,
		});
	});

	it("throws 404 when session does not exist", async () => {
		const { id: userId, username } = await seedUser();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateSession(taker, { sessionID: "no-such-session", name: "ValidName" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 403 when the user does not own the session", async () => {
		const { id: ownerId } = await seedUser({ username: "owner_sess" });
		const { id: otherId, username: otherName } = await seedUser({ username: "other_sess" });

		const sessionId = `Q${"b".repeat(40)}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: ownerId,
				game: "iidx-sp",
				name: "N",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherName } };

		await expect(
			ACTION_UpdateSession(taker, { sessionID: sessionId, name: "Hijacked" }),
		).rejects.toMatchObject({ code: 403 });
	});

	it("updates name in the database", async () => {
		const { id: userId, username } = await seedUser();
		const sessionId = `Q${"c".repeat(40)}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "Old",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateSession(taker, {
			sessionID: sessionId,
			name: "NewName",
		});

		const doc = await LoadSessionDocumentById(sessionId);
		expect(doc?.name).toBe("NewName");

		const row = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_SESSION")
			.orderBy("ts_end", "desc")
			.executeTakeFirst();

		expect(row).toMatchObject({ result: "GOOD", ip: "127.0.0.1", user_id: userId });
	});
});
