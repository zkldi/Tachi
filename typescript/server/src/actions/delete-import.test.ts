import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { ACTION_DeleteImport } from "./delete-import";

describe("ACTION_DeleteImport", () => {
	let importCounter = 0;

	function nextImportId() {
		return `import-di-${++importCounter}`;
	}

	async function seedFinishedImport(userId: number) {
		const id = nextImportId();
		const finishedAt = new Date().toISOString();

		await DB.insertInto("import")
			.values({
				id,
				user_id: userId,
				time_started: finishedAt,
				time_finished: finishedAt,
				game_group: "iidx",
				import_type: "file/batch-manual" as never,
				user_intent: true,
				service: "test",
				status: "completed",
			})
			.execute();

		return id;
	}

	it("throws 404 when the import does not exist", async () => {
		const { id: userId, username } = await seedUser({ username: "di_404" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_DeleteImport(taker, { id: "missing-import" })).rejects.toMatchObject({
			code: 404,
		});
	});

	it("throws 403 when the import belongs to another user", async () => {
		const { id: ownerId } = await seedUser({ username: "di_owner" });
		const { id: otherId, username: otherName } = await seedUser({ username: "di_other" });
		const importId = await seedFinishedImport(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherName } };

		await expect(ACTION_DeleteImport(taker, { id: importId })).rejects.toMatchObject({
			code: 403,
		});
	});

	it("allows an admin to delete another users import", async () => {
		const { id: ownerId } = await seedUser({ username: "di_victim" });
		const { id: adminId, username: adminName } = await seedUser({
			username: "di_admin",
			authLevel: "admin",
		});
		const importId = await seedFinishedImport(ownerId);
		const taker = { ip: "127.0.0.1", acct: { id: adminId, username: adminName } };

		await ACTION_DeleteImport(taker, { id: importId });

		const row = await DB.selectFrom("import")
			.select("id")
			.where("id", "=", importId)
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("removes the import row RevertImport-style when it has no scores", async () => {
		const { id: userId, username } = await seedUser({ username: "di_ok" });
		const importId = await seedFinishedImport(userId);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteImport(taker, { id: importId });

		const row = await DB.selectFrom("import")
			.select("id")
			.where("id", "=", importId)
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("throws 409 when the user has an active import lock", async () => {
		const { id: userId, username } = await seedUser({ username: "di_locked" });
		const importId = await seedFinishedImport(userId);
		const now = new Date().toISOString();

		await DB.insertInto("import_lock")
			.values({
				user_id: userId,
				locked: true,
				locked_at: now,
			})
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_DeleteImport(taker, { id: importId })).rejects.toMatchObject({
			code: 409,
		});
	});

	it("writes a GOOD action row on success", async () => {
		const { id: userId, username } = await seedUser({ username: "di_audit" });
		const importId = await seedFinishedImport(userId);
		const taker = { ip: "10.0.0.4", acct: { id: userId, username } };

		await ACTION_DeleteImport(taker, { id: importId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_IMPORT")
			.orderBy("ts_end", "desc")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_IMPORT",
			result: "GOOD",
			ip: "10.0.0.4",
			user_id: userId,
		});
	});
});
