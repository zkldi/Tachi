import DB from "#services/pg/db";
import { seedUser, seedVerifyEmailToken } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_ChangeEmail } from "./change-email";

// ─── ACTION_ChangeEmail ────────────────────────────────────────────────────────

describe("ACTION_ChangeEmail", () => {
	const PASSWORD = "hunter2hunter2";
	const NEW_EMAIL = "new@example.com";

	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({
			username: "test_user",
			email: "old@example.com",
			password: PASSWORD,
			withCredential: true,
		}));
	});

	// ── Wrong password ────────────────────────────────────────────────────────

	it("throws 401 when the password is incorrect", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": "wrongpassword" }),
		).rejects.toMatchObject({ code: 401 });
	});

	it("writes a BAD action row when the password is wrong", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": "wrongpassword" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not change the stored email when the password is wrong", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": "wrongpassword" }),
		).rejects.toThrow();

		const row = await DB.selectFrom("priv_account_credential")
			.select("email")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.email).toBe("old@example.com");
	});

	// ── Email already in use ──────────────────────────────────────────────────

	it("throws 409 when the new email is already in use by another user", async () => {
		await seedUser({
			username: "other_user",
			email: NEW_EMAIL,
			withCredential: true,
		});

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD }),
		).rejects.toMatchObject({ code: 409 });
	});

	it("writes a BAD action row when the new email is already in use", async () => {
		await seedUser({
			username: "other_user",
			email: NEW_EMAIL,
			withCredential: true,
		});

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not change the stored email when the target email is already in use", async () => {
		await seedUser({
			username: "other_user",
			email: NEW_EMAIL,
			withCredential: true,
		});

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD }),
		).rejects.toThrow();

		const row = await DB.selectFrom("priv_account_credential")
			.select("email")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.email).toBe("old@example.com");
	});

	it("throws 409 when the user tries to change to their own current email", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ChangeEmail(taker, { "!email": "old@example.com", "!password": PASSWORD }),
		).rejects.toMatchObject({ code: 409 });
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns an empty object on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_ChangeEmail(taker, {
			"!email": NEW_EMAIL,
			"!password": PASSWORD,
		});

		expect(result).toEqual({});
	});

	it("updates the stored email to the new address", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const row = await DB.selectFrom("priv_account_credential")
			.select("email")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.email).toBe(NEW_EMAIL);
	});

	it("inserts a verify-email token for the new address", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const row = await DB.selectFrom("priv_verify_email_token")
			.selectAll()
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.email).toBe(NEW_EMAIL);
	});

	it("generates a non-empty hex token", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.token).toMatch(/^[0-9a-f]{40}$/u);
	});

	it("keeps exactly one token row for the user after the change", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const rows = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.execute();

		expect(rows).toHaveLength(1);
	});

	it("replaces any pre-existing verify-email token", async () => {
		await seedVerifyEmailToken(userId, "old@example.com", "OLD_TOKEN_ABCDEF1234");

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const rows = await DB.selectFrom("priv_verify_email_token")
			.select(["token", "email"])
			.where("user_id", "=", userId)
			.execute();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.token).not.toBe("OLD_TOKEN_ABCDEF1234");
		expect(rows[0]?.email).toBe(NEW_EMAIL);
	});

	it("does not touch verify-email tokens belonging to other users", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
		});
		await seedVerifyEmailToken(other.id, "other@example.com", "OTHER_TOKEN_XYZ");

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(row.token).toBe("OTHER_TOKEN_XYZ");
	});

	it("does not affect other users' credential rows", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
		});

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const row = await DB.selectFrom("priv_account_credential")
			.select("email")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(row.email).toBe("other@example.com");
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row to the audit log on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CHANGE_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CHANGE_EMAIL",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("does not store the plaintext password in the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_EMAIL")
			.executeTakeFirstOrThrow();

		expect(JSON.stringify(action.input)).not.toContain(PASSWORD);
	});

	it("omits private fields from the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_ChangeEmail(taker, { "!email": NEW_EMAIL, "!password": PASSWORD });

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_EMAIL")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).toEqual({});
	});
});
