import { ONE_MONTH } from "#lib/constants/time";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { seedInvite, seedUser } from "#test-utils/pg-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ACTION_CreateInvite } from "./create-invite";

describe("ACTION_CreateInvite", () => {
	let originalInviteConfig: typeof ServerConfig.INVITE_CODE_CONFIG;

	beforeEach(() => {
		originalInviteConfig = ServerConfig.INVITE_CODE_CONFIG;
		ServerConfig.INVITE_CODE_CONFIG = {
			BATCH_SIZE: 5,
			INVITE_CAP: 100,
			BETA_USER_BONUS: 0,
		};
	});

	afterEach(() => {
		ServerConfig.INVITE_CODE_CONFIG = originalInviteConfig;
	});

	async function setAccountJoinedMonthsAgo(userId: number, months: number) {
		await DB.updateTable("account")
			.set({ joined: new Date(Date.now() - months * ONE_MONTH).toISOString() })
			.where("id", "=", userId)
			.execute();
	}

	it("throws 400 when the user is at their invite cap", async () => {
		const { id: userId, username } = await seedUser({ username: "capped_user" });

		ServerConfig.INVITE_CODE_CONFIG = {
			BATCH_SIZE: 1,
			INVITE_CAP: 100,
			BETA_USER_BONUS: 0,
		};

		await setAccountJoinedMonthsAgo(userId, 1);

		await seedInvite(userId, "ALREADY_HAVE_ONE");

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_CreateInvite(taker, {})).rejects.toMatchObject({
			code: 400,
		});
	});

	it("lets admin users bypass the invite cap", async () => {
		const { id: userId, username } = await seedUser({
			username: "admin_inviter",
			authLevel: "admin",
		});

		ServerConfig.INVITE_CODE_CONFIG = {
			BATCH_SIZE: 1,
			INVITE_CAP: 100,
			BETA_USER_BONUS: 0,
		};

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateInvite(taker, {});

		expect(result.consumed).toBe(false);
		expect(result.createdBy).toBe(userId);

		const row = await DB.selectFrom("priv_invite")
			.select("code")
			.where("code", "=", result.code)
			.executeTakeFirst();

		expect(row).toBeDefined();
	});

	it("inserts a priv_invite row and returns an unconsumed invite", async () => {
		const { id: userId, username } = await seedUser({ username: "happy_inviter" });

		await setAccountJoinedMonthsAgo(userId, 1);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateInvite(taker, {});

		expect(result).toMatchObject({
			createdBy: userId,
			consumed: false,
			consumedAt: null,
			consumedBy: null,
		});
		expect(result.code.length).toBeGreaterThan(0);

		const row = await DB.selectFrom("priv_invite")
			.select(["code", "consumed", "created_by"])
			.where("code", "=", result.code)
			.executeTakeFirstOrThrow();

		expect(row.consumed).toBe(false);
		expect(row.created_by).toBe(userId);
	});

	it("serializes concurrent creates so invite count cannot exceed the cap", async () => {
		const { id: userId, username } = await seedUser({ username: "concurrent_user" });

		ServerConfig.INVITE_CODE_CONFIG = {
			BATCH_SIZE: 1,
			INVITE_CAP: 100,
			BETA_USER_BONUS: 0,
		};

		await setAccountJoinedMonthsAgo(userId, 1);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const [a, b] = await Promise.allSettled([
			ACTION_CreateInvite(taker, {}),
			ACTION_CreateInvite(taker, {}),
		]);

		const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
		const rejected = [a, b].filter((r) => r.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 400 });

		const { count } = await DB.selectFrom("priv_invite")
			.select(DB.fn.countAll().as("count"))
			.where("created_by", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(count)).toBe(1);
	});

	it("writes a GOOD action row on success", async () => {
		const { id: userId, username } = await seedUser({ username: "audit_good" });

		await setAccountJoinedMonthsAgo(userId, 1);

		const taker = { ip: "10.0.0.2", acct: { id: userId, username } };

		await ACTION_CreateInvite(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CREATE_INVITE")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CREATE_INVITE",
			result: "GOOD",
			ip: "10.0.0.2",
			user_id: userId,
		});
	});

	it("writes a BAD action row when at invite cap", async () => {
		const { id: userId, username } = await seedUser({ username: "audit_bad" });

		ServerConfig.INVITE_CODE_CONFIG = {
			BATCH_SIZE: 1,
			INVITE_CAP: 100,
			BETA_USER_BONUS: 0,
		};

		await setAccountJoinedMonthsAgo(userId, 1);
		await seedInvite(userId, "USES_QUOTA");

		const taker = { ip: "10.0.0.3", acct: { id: userId, username } };

		await expect(ACTION_CreateInvite(taker, {})).rejects.toMatchObject({ code: 400 });

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CREATE_INVITE")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
