import DB from "#services/pg/db";
import { seedUser, seedVerifyEmailToken } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_ResendVerifyEmail } from "./resend-verify-email";

// ─── ACTION_ResendVerifyEmail ──────────────────────────────────────────────────

describe("ACTION_ResendVerifyEmail", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser());
	});

	// ── User with a pending verification token ─────────────────────────────────

	it("returns an empty object when a pending token exists", async () => {
		await seedVerifyEmailToken(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		const result = await ACTION_ResendVerifyEmail(taker, {});

		expect(result).toEqual({});
	});

	it("rotates the token so the new value differs from the original", async () => {
		const originalToken = await seedVerifyEmailToken(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.token).not.toBe(originalToken);
	});

	it("keeps exactly one token row for the user after resending", async () => {
		await seedVerifyEmailToken(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const rows = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.execute();

		expect(rows).toHaveLength(1);
	});

	it("generates a non-empty hex token", async () => {
		await seedVerifyEmailToken(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.token).toMatch(/^[0-9a-f]{40}$/u);
	});

	it("does not affect tokens belonging to other users", async () => {
		const other = await seedUser({ username: "other_user" });
		const otherToken = await seedVerifyEmailToken(other.id, undefined, "OTHER_TOKEN_XYZ");
		await seedVerifyEmailToken(userId);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", other.id)
			.executeTakeFirstOrThrow();

		expect(row.token).toBe(otherToken);
	});

	it("writes a GOOD action row to the audit log on success", async () => {
		await seedVerifyEmailToken(userId);

		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "RESEND_VERIFY_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "RESEND_VERIFY_EMAIL",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	// ── User who has already verified their email ──────────────────────────────

	it("returns an empty object when the user has no pending token", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		const result = await ACTION_ResendVerifyEmail(taker, {});

		expect(result).toEqual({});
	});

	it("does not insert a token row when the user has already verified", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const rows = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("user_id", "=", userId)
			.execute();

		expect(rows).toHaveLength(0);
	});

	it("writes a GOOD action row even when the user has already verified", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResendVerifyEmail(taker, {});

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "RESEND_VERIFY_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("GOOD");
	});
});
