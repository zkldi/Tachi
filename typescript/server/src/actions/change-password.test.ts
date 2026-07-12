import { PasswordCompare } from "#lib/auth/auth";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_ChangePassword } from "./change-password";

// ─── ACTION_ChangePassword ────────────────────────────────────────────────────

describe("ACTION_ChangePassword", () => {
	const OLD_PASSWORD = "old_password_123";
	const NEW_PASSWORD = "new_password_456";

	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({
			username: "test_user",
			password: OLD_PASSWORD,
			withCredential: true,
		}));
	});

	// ── Wrong old password ────────────────────────────────────────────────────

	it("throws 401 when the old password is incorrect", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangePassword(taker, {
				"!oldPassword": "wrong_password_xxx",
				"!password": NEW_PASSWORD,
			}),
		).rejects.toMatchObject({ code: 401 });
	});

	it("writes a BAD action row when the old password is wrong", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangePassword(taker, {
				"!oldPassword": "wrong_password_xxx",
				"!password": NEW_PASSWORD,
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_PASSWORD")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not modify the stored password hash when the old password is wrong", async () => {
		const before = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangePassword(taker, {
				"!oldPassword": "wrong_password_xxx",
				"!password": NEW_PASSWORD,
			}),
		).rejects.toThrow();

		const after = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(after.password).toBe(before.password);
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns an empty object on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		expect(result).toEqual({});
	});

	it("replaces the stored password hash so the new password verifies", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const row = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		await expect(PasswordCompare(NEW_PASSWORD, row.password)).resolves.toBe(true);
	});

	it("invalidates the old password after a successful change", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const row = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		await expect(PasswordCompare(OLD_PASSWORD, row.password)).resolves.toBe(false);
	});

	it("stores a bcrypt hash, not the plaintext password", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const row = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.password).not.toBe(NEW_PASSWORD);
		expect(row.password).toMatch(/^\$2[ab]\$/u);
	});

	it("does not affect other users' credential rows", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			password: "other_users_password",
			withCredential: true,
		});

		const otherBefore = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const otherAfter = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(otherAfter.password).toBe(otherBefore.password);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row to the audit log on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CHANGE_PASSWORD")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CHANGE_PASSWORD",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("does not store either password in the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangePassword(taker, {
			"!oldPassword": OLD_PASSWORD,
			"!password": NEW_PASSWORD,
		});

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_PASSWORD")
			.executeTakeFirstOrThrow();

		const input = JSON.stringify(action.input);

		expect(input).not.toContain(OLD_PASSWORD);
		expect(input).not.toContain(NEW_PASSWORD);
	});
});
