import DB from "#services/pg/db";
import { seedUser, seedVerifyEmailToken } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ANON_ACTION_VerifyEmail } from "./verify-email";

// ─── ANON_ACTION_VerifyEmail ───────────────────────────────────────────────────

describe("ANON_ACTION_VerifyEmail", () => {
	const taker = { ip: "127.0.0.1" };

	let userId: number;
	let token: string;

	beforeEach(async () => {
		const user = await seedUser();
		userId = user.id;
		token = await seedVerifyEmailToken(userId);
	});

	// ── Happy path ─────────────────────────────────────────────────────────────

	it("returns an empty object on success", async () => {
		const result = await ANON_ACTION_VerifyEmail(taker, { code: token });

		expect(result).toEqual({});
	});

	it("deletes the token row from the database after use", async () => {
		await ANON_ACTION_VerifyEmail(taker, { code: token });

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("token", "=", token)
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});

	it("writes a GOOD action row to the audit log on success", async () => {
		await ANON_ACTION_VerifyEmail(taker, { code: token });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "VERIFY_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "VERIFY_EMAIL",
			result: "GOOD",
			ip: "127.0.0.1",
		});
	});

	it("records the code in the audit log input", async () => {
		await ANON_ACTION_VerifyEmail(taker, { code: token });

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "VERIFY_EMAIL")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).toMatchObject({ code: token });
	});

	// ── Invalid code ───────────────────────────────────────────────────────────

	it("throws ExpectedErr when the code does not exist", async () => {
		await expect(ANON_ACTION_VerifyEmail(taker, { code: "BOGUS_CODE" })).rejects.toMatchObject({
			code: 400,
			reason: "Invalid email verification code.",
		});
	});

	it("writes a BAD action row when the code does not exist", async () => {
		await expect(ANON_ACTION_VerifyEmail(taker, { code: "BOGUS_CODE" })).rejects.toMatchObject({
			code: 400,
		});

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "VERIFY_EMAIL")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not delete any token rows when the code does not exist", async () => {
		await expect(ANON_ACTION_VerifyEmail(taker, { code: "BOGUS_CODE" })).rejects.toMatchObject({
			code: 400,
		});

		const row = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("token", "=", token)
			.executeTakeFirst();

		expect(row?.token).toBe(token);
	});

	// ── Token is single-use ────────────────────────────────────────────────────

	it("throws ExpectedErr on a second call with the same code after it has been consumed", async () => {
		await ANON_ACTION_VerifyEmail(taker, { code: token });

		await expect(ANON_ACTION_VerifyEmail(taker, { code: token })).rejects.toMatchObject({
			code: 400,
			reason: "Invalid email verification code.",
		});
	});

	// ── Multiple tokens ────────────────────────────────────────────────────────

	it("only deletes the matching token, leaving other tokens intact", async () => {
		const otherUser = await seedUser({ username: "other_user" });
		const otherToken = await seedVerifyEmailToken(otherUser.id, undefined, "OTHER_TOKEN_XYZ");

		await ANON_ACTION_VerifyEmail(taker, { code: token });

		const other = await DB.selectFrom("priv_verify_email_token")
			.select("token")
			.where("token", "=", otherToken)
			.executeTakeFirst();

		expect(other?.token).toBe(otherToken);
	});
});
