import { PasswordCompare } from "#lib/auth/auth";
import DB from "#services/pg/db";
import { seedResetToken, seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ANON_ACTION_ResetPassword } from "./reset-password";

// ─── ANON_ACTION_ResetPassword ────────────────────────────────────────────────

describe("ANON_ACTION_ResetPassword", () => {
	const taker = { ip: "127.0.0.1" };

	let user: Awaited<ReturnType<typeof seedUser>>;

	beforeEach(async () => {
		user = await seedUser({ withCredential: true });
	});

	// ── Happy path ─────────────────────────────────────────────────────────────

	it("returns { userID } when a valid fresh token is supplied", async () => {
		await seedResetToken(user.id);

		const result = await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		expect(result).toEqual({ userID: user.id });
	});

	it("updates the password hash stored in priv_account_credential", async () => {
		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		const cred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare("new_secure_password", cred.password)).toBe(true);
	});

	it("the old password no longer matches after a successful reset", async () => {
		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		const cred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare(user.password, cred.password)).toBe(false);
	});

	it("writes a GOOD action row to the audit log on success", async () => {
		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(
			{ ip: "10.0.0.1" },
			{
				code: "VALID_RESET_TOKEN",
				"!password": "new_secure_password",
			},
		);

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "RESET_PASSWORD")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "RESET_PASSWORD",
			result: "GOOD",
			ip: "10.0.0.1",
		});
	});

	// ── Expired token ──────────────────────────────────────────────────────────

	it("throws 400 when the reset token is older than 24 hours", async () => {
		await seedResetToken(user.id, "EXPIRED_TOKEN", 25);

		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "EXPIRED_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("does not update the password when the token is expired", async () => {
		await seedResetToken(user.id, "EXPIRED_TOKEN", 25);

		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "EXPIRED_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toThrow();

		const cred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare(user.password, cred.password)).toBe(true);
	});

	it("writes a BAD action row when the token is expired", async () => {
		await seedResetToken(user.id, "EXPIRED_TOKEN", 25);

		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "EXPIRED_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "RESET_PASSWORD")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Token boundary ─────────────────────────────────────────────────────────

	it("accepts a token created 23 hours ago (still within the 24-hour window)", async () => {
		await seedResetToken(user.id, "NEAR_EXPIRY_TOKEN", 23);

		const result = await ANON_ACTION_ResetPassword(taker, {
			code: "NEAR_EXPIRY_TOKEN",
			"!password": "new_secure_password",
		});

		expect(result).toEqual({ userID: user.id });
	});

	// ── Invalid token ──────────────────────────────────────────────────────────

	it("throws when the reset code does not exist in the database", async () => {
		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "NONEXISTENT_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toThrow();
	});

	it("does not update the password when the code does not exist", async () => {
		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "NONEXISTENT_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toThrow();

		const cred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare(user.password, cred.password)).toBe(true);
	});

	it("writes a BAD action row when the code does not exist", async () => {
		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "NONEXISTENT_TOKEN",
				"!password": "new_secure_password",
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "RESET_PASSWORD")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Token invalidation ────────────────────────────────────────────────────

	it("deletes the token from priv_password_reset_token after use", async () => {
		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		const remaining = await DB.selectFrom("priv_password_reset_token")
			.select("token")
			.where("token", "=", "VALID_RESET_TOKEN")
			.executeTakeFirst();

		expect(remaining).toBeUndefined();
	});

	it("rejects a second use of the same reset code", async () => {
		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		await expect(
			ANON_ACTION_ResetPassword(taker, {
				code: "VALID_RESET_TOKEN",
				"!password": "attacker_password",
			}),
		).rejects.toMatchObject({ code: 404 });

		const cred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare("new_secure_password", cred.password)).toBe(true);
	});

	// ── Token isolation ────────────────────────────────────────────────────────

	it("does not modify another user's password when resetting", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			password: "other_original_pw",
			withCredential: true,
		});

		await seedResetToken(user.id);

		await ANON_ACTION_ResetPassword(taker, {
			code: "VALID_RESET_TOKEN",
			"!password": "new_secure_password",
		});

		const otherCred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare("other_original_pw", otherCred.password)).toBe(true);
	});

	it("a token belonging to another user cannot be used to reset a different user's password", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			password: "other_original_pw",
			withCredential: true,
		});

		await seedResetToken(other.id, "OTHER_USER_TOKEN");

		const result = await ANON_ACTION_ResetPassword(taker, {
			code: "OTHER_USER_TOKEN",
			"!password": "new_secure_password",
		});

		// The action succeeds but updates other's password, not user's
		expect(result).toEqual({ userID: other.id });

		const userCred = await DB.selectFrom("priv_account_credential")
			.select("password")
			.where("user_id", "=", user.id)
			.executeTakeFirstOrThrow();

		expect(await PasswordCompare(user.password, userCred.password)).toBe(true);
	});
});
