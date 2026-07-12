import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { seedInvite, seedUser } from "#test-utils/pg-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ANON_ACTION_Register } from "./register";

// ─── ANON_ACTION_Register ─────────────────────────────────────────────────────

describe("ANON_ACTION_Register", () => {
	const taker = { ip: "127.0.0.1" };

	let inviteCode: string;

	beforeEach(async () => {
		const { id } = await seedUser({ withCredential: true, withSettings: true });
		inviteCode = await seedInvite(id);
	});

	// ── Happy path ─────────────────────────────────────────────────────────────

	it("returns the new user's ID on success", async () => {
		const result = await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "newuser@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		expect(Number(result.userID)).toBeGreaterThan(0);
	});

	it("inserts the account row into the database", async () => {
		await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "newuser@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		const user = await DB.selectFrom("account")
			.select("username")
			.where("username", "=", "newuser")
			.executeTakeFirst();

		expect(user?.username).toBe("newuser");
	});

	it("forces the stored email to lowercase", async () => {
		const { userID } = await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "NewUser@Example.COM",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		const cred = await DB.selectFrom("priv_account_credential")
			.select("email")
			.where("user_id", "=", userID)
			.executeTakeFirstOrThrow();

		expect(cred.email).toBe("newuser@example.com");
	});

	it("marks the invite code as consumed on success", async () => {
		await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "newuser@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		const invite = await DB.selectFrom("priv_invite")
			.select(["consumed", "consumed_by"])
			.where("code", "=", inviteCode)
			.executeTakeFirstOrThrow();

		expect(invite.consumed).toBe(true);
		expect(invite.consumed_by).toBeDefined();
	});

	it("writes a GOOD action row to the audit log on success", async () => {
		await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "newuser@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "REGISTER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "REGISTER",
			result: "GOOD",
			ip: "127.0.0.1",
		});
	});

	// ── Conflicting username / email ───────────────────────────────────────────

	it("throws 409 when username is already taken", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "test_user",
				"!password": "securepassword",
				"!email": "other@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toMatchObject({ code: 409 });
	});

	it("throws 409 when username is already taken (case-insensitive)", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "TEST_USER",
				"!password": "securepassword",
				"!email": "other@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toMatchObject({ code: 409 });
	});

	it("throws 409 when email is already in use", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "brandnewuser",
				"!password": "securepassword",
				"!email": "test@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toMatchObject({ code: 409 });
	});

	it("treats the input email as case-insensitive before checking for duplicates", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "brandnewuser",
				"!password": "securepassword",
				"!email": "TEST@EXAMPLE.COM",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toMatchObject({ code: 409 });
	});

	// ── Invite code ────────────────────────────────────────────────────────────

	it("throws 400 when no invite code is given and the server requires invites", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "brandnewuser",
				"!password": "securepassword",
				"!email": "brandnewuser@example.com",
				"!captcha": "test",
				"!inviteCode": null,
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws when the invite code does not exist", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "brandnewuser",
				"!password": "securepassword",
				"!email": "brandnewuser@example.com",
				"!captcha": "test",
				"!inviteCode": "BOGUS_CODE",
			}),
		).rejects.toThrow();
	});

	it("does not consume the invite code on a failed registration", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "test_user",
				"!password": "securepassword",
				"!email": "other@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toThrow();

		const invite = await DB.selectFrom("priv_invite")
			.select("consumed")
			.where("code", "=", inviteCode)
			.executeTakeFirstOrThrow();

		expect(invite.consumed).toBe(false);
	});

	it("does not insert a partial user when the invite code is invalid", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "newuser",
				"!password": "securepassword",
				"!email": "newuser@example.com",
				"!captcha": "test",
				"!inviteCode": "BOGUS_CODE",
			}),
		).rejects.toThrow();

		const user = await DB.selectFrom("account")
			.select("username")
			.where("username", "=", "newuser")
			.executeTakeFirst();

		expect(user).toBeUndefined();
	});

	// ── Sequence gaps ─────────────────────────────────────────────────────────

	it("does not burn sequence values on failed registrations with bad invite codes", async () => {
		const first = await ANON_ACTION_Register(taker, {
			username: "firstuser",
			"!password": "securepassword",
			"!email": "first@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		// Need a fresh invite for the next successful signup.
		const { id: seedId } = await seedUser({
			username: "inviter2",
			email: "inviter2@example.com",
		});
		const secondInvite = await seedInvite(seedId, "SECOND_INVITE");

		// 10 failed registrations — bad invite code but unique username/email,
		// so they enter the transaction and reach AddNewUser before failing.
		for (let i = 0; i < 10; i++) {
			await expect(
				ANON_ACTION_Register(taker, {
					username: `baduser${i}`,
					"!password": "securepassword",
					"!email": `bad${i}@example.com`,
					"!captcha": "test",
					"!inviteCode": "BOGUS_CODE",
				}),
			).rejects.toThrow();
		}

		const second = await ANON_ACTION_Register(taker, {
			username: "seconduser",
			"!password": "securepassword",
			"!email": "second@example.com",
			"!captcha": "test",
			"!inviteCode": secondInvite,
		});

		// If sequences are gap-free, the second real user should be first.id + 1
		// (skipping only the seedUser helper we inserted, which also burns one).
		// With BIGSERIAL, this FAILS: the 10 rolled-back txns each burned a value.
		expect(second.userID).toBe(first.userID + 2);
	});

	// ── Audit log ──────────────────────────────────────────────────────────────

	it("writes a BAD action row when the username is already taken", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "test_user",
				"!password": "securepassword",
				"!email": "other@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "REGISTER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("writes a BAD action row when the email is already in use", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "brandnewuser",
				"!password": "securepassword",
				"!email": "test@example.com",
				"!captcha": "test",
				"!inviteCode": inviteCode,
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "REGISTER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("omits the password from the audit log input", async () => {
		await ANON_ACTION_Register(taker, {
			username: "newuser",
			"!password": "securepassword",
			"!email": "newuser@example.com",
			"!captcha": "test",
			"!inviteCode": inviteCode,
		});

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "REGISTER")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).not.toHaveProperty("!password");
	});
});

// ─── Bootstrap invite (INVITE_ADMIN_INITIAL_INVITE_CODE) ──────────────────────

describe("ANON_ACTION_Register - bootstrap invite", () => {
	const taker = { ip: "127.0.0.1" };
	const BOOTSTRAP_CODE = "BOOTSTRAP_SECRET_FOR_TESTS";

	let originalBootstrap: typeof ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE;

	beforeEach(() => {
		originalBootstrap = ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE;
		ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE = BOOTSTRAP_CODE;
	});

	afterEach(() => {
		ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE = originalBootstrap;
	});

	it("creates an admin user when the instance has no accounts", async () => {
		const result = await ANON_ACTION_Register(taker, {
			username: "firstadmin",
			"!password": "securepassword",
			"!email": "admin@example.com",
			"!captcha": "test",
			"!inviteCode": BOOTSTRAP_CODE,
		});

		const account = await DB.selectFrom("account")
			.select(["account.id", "account.auth_level"])
			.where("account.id", "=", result.userID)
			.executeTakeFirstOrThrow();

		expect(account.auth_level).toBe("admin");
	});

	it("does not consume any priv_invite row", async () => {
		await ANON_ACTION_Register(taker, {
			username: "firstadmin",
			"!password": "securepassword",
			"!email": "admin@example.com",
			"!captcha": "test",
			"!inviteCode": BOOTSTRAP_CODE,
		});

		const invites = await DB.selectFrom("priv_invite")
			.select(DB.fn.countAll().as("count"))
			.executeTakeFirstOrThrow();

		expect(Number(invites.count)).toBe(0);
	});

	it("rejects the bootstrap code when an account already exists", async () => {
		await seedUser();

		await expect(
			ANON_ACTION_Register(taker, {
				username: "seconduser",
				"!password": "securepassword",
				"!email": "second@example.com",
				"!captcha": "test",
				"!inviteCode": BOOTSTRAP_CODE,
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("rejects a wrong code even on an empty instance", async () => {
		await expect(
			ANON_ACTION_Register(taker, {
				username: "firstadmin",
				"!password": "securepassword",
				"!email": "admin@example.com",
				"!captcha": "test",
				"!inviteCode": "WRONG_CODE",
			}),
		).rejects.toThrow();
	});

	it("falls through to normal invite validation when env is unset", async () => {
		ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE = undefined;

		await expect(
			ANON_ACTION_Register(taker, {
				username: "firstadmin",
				"!password": "securepassword",
				"!email": "admin@example.com",
				"!captcha": "test",
				"!inviteCode": "NONEXISTENT",
			}),
		).rejects.toThrow();
	});
});
