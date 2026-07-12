import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UpdateKshookSv6cSettings } from "./update-kshook-sv6c-settings";

async function getKshookSettings(userId: number) {
	return DB.selectFrom("svc_kshook_sv6c_settings")
		.selectAll()
		.where("user_id", "=", userId)
		.executeTakeFirst();
}

describe("ACTION_UpdateKshookSv6cSettings", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Insert (no existing row) ───────────────────────────────────────────────

	it("inserts a new row when none exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: true });

		const row = await getKshookSettings(userId);
		expect(row).toBeDefined();
		expect(row!.force_static_import).toBe(true);
	});

	it("returns the updated forceStaticImport value", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateKshookSv6cSettings(taker, {
			forceStaticImport: false,
		});

		expect(result).toEqual({ forceStaticImport: false });
	});

	// ── Update (existing row) ──────────────────────────────────────────────────

	it("updates the existing row when one already exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: false });

		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: true });

		const row = await getKshookSettings(userId);
		expect(row!.force_static_import).toBe(true);
	});

	it("does not create a second row on repeated calls", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: false });
		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: true });

		const count = await DB.selectFrom("svc_kshook_sv6c_settings")
			.select(DB.fn.countAll().as("count"))
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(count.count)).toBe(1);
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not affect other users' settings", async () => {
		const other = await seedUser({ username: "other_user" });
		const otherTaker = {
			ip: "127.0.0.1",
			acct: { id: other.id, username: other.username },
		};
		await ACTION_UpdateKshookSv6cSettings(otherTaker, { forceStaticImport: true });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: false });

		const otherRow = await getKshookSettings(other.id);
		expect(otherRow!.force_static_import).toBe(true);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateKshookSv6cSettings(taker, { forceStaticImport: true });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_KSHOOK_SV6C_SETTINGS")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_KSHOOK_SV6C_SETTINGS",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
