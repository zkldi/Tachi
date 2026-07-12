import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_ChangeUsername } from "./change-username";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Insert an `account_username_change` row with the given age in days, so tests
 * can exercise the 6-month cooldown without real time passing.
 */
async function seedUsernameChange(
	userId: number,
	opts: { ageDays?: number; previousUsername?: string; username?: string } = {},
) {
	const ageDays = opts.ageDays ?? 0;
	const timestamp = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();

	await DB.insertInto("account_username_change")
		.values({
			user_id: userId,
			username: opts.username ?? "current_name",
			previous_username: opts.previousUsername ?? "old_name",
			timestamp,
		})
		.execute();
}

// ─── ACTION_ChangeUsername ─────────────────────────────────────────────────────

describe("ACTION_ChangeUsername", () => {
	const PASSWORD = "hunter2hunter2";
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({
			username: "original_user",
			password: PASSWORD,
			withCredential: true,
		}));
	});

	// ── Same-username guard ────────────────────────────────────────────────────

	it("throws 400 when newUsername is identical to the current username", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, { newUsername: username, "!password": PASSWORD }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when newUsername matches the current username", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, { newUsername: username, "!password": PASSWORD }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Password validation ────────────────────────────────────────────────────

	it("throws 401 when the password is incorrect", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, {
				newUsername: "new_username",
				"!password": "wrongpassword",
			}),
		).rejects.toMatchObject({ code: 401 });
	});

	it("writes a BAD action row when the password is wrong", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, {
				newUsername: "new_username",
				"!password": "wrongpassword",
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not modify the account row when the password is wrong", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, {
				newUsername: "new_username",
				"!password": "wrongpassword",
			}),
		).rejects.toThrow();

		const row = await DB.selectFrom("account")
			.select("username")
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.username).toBe(username);
	});

	// ── Cooldown guard ────────────────────────────────────────────────────────

	it("throws 400 when the user changed their username fewer than 6 months ago", async () => {
		await seedUsernameChange(userId, { ageDays: 10 });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, { newUsername: "new_username", "!password": PASSWORD }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when the cooldown has not elapsed", async () => {
		await seedUsernameChange(userId, { ageDays: 10 });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, { newUsername: "new_username", "!password": PASSWORD }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not modify the account row when within the cooldown period", async () => {
		await seedUsernameChange(userId, { ageDays: 10 });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeUsername(taker, { newUsername: "new_username", "!password": PASSWORD }),
		).rejects.toThrow();

		const row = await DB.selectFrom("account")
			.select("username")
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.username).toBe(username);
	});

	it("allows a username change after the 6-month cooldown has elapsed", async () => {
		await seedUsernameChange(userId, { ageDays: 181 });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		expect(result).toMatchObject({ prevUsername: username, newUsername: "new_username" });
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns the previous and new username on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		expect(result).toEqual({ prevUsername: username, newUsername: "new_username" });
	});

	it("updates the account row to the new username", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const row = await DB.selectFrom("account")
			.select("username")
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.username).toBe("new_username");
	});

	it("inserts a row into account_username_change with the correct fields", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const change = await DB.selectFrom("account_username_change")
			.selectAll()
			.where("user_id", "=", userId)
			.orderBy("timestamp", "desc")
			.executeTakeFirstOrThrow();

		expect(change).toMatchObject({
			user_id: userId,
			username: "new_username",
			previous_username: username,
		});
	});

	it("only inserts one account_username_change row on a fresh account", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const rows = await DB.selectFrom("account_username_change")
			.select("user_id")
			.where("user_id", "=", userId)
			.execute();

		expect(rows).toHaveLength(1);
	});

	it("does not affect other users' account rows", async () => {
		const other = await seedUser({ username: "other_user" });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const row = await DB.selectFrom("account")
			.select("username")
			.where("id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(row.username).toBe("other_user");
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row to the audit log on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CHANGE_USERNAME",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("records the new username in the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).toMatchObject({ newUsername: "new_username" });
	});

	it("does not store the plaintext password in the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeUsername(taker, {
			newUsername: "new_username",
			"!password": PASSWORD,
		});

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_USERNAME")
			.executeTakeFirstOrThrow();

		const input = JSON.stringify(action.input);

		expect(input).not.toContain(PASSWORD);
	});
});
