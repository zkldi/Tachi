import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_CreateApiToken } from "./create-api-token";
import { getApiToken, seedApiClient, seedApiToken } from "./test-utils/api-tokens";

// ─── ACTION_CreateApiToken ────────────────────────────────────────────────────

describe("ACTION_CreateApiToken", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Input validation ──────────────────────────────────────────────────────

	it("throws 400 when both clientID and permissions are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiToken(taker, {
				clientID: "CXSomeClient",
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when neither clientID nor permissions are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_CreateApiToken(taker, {})).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 for an invalid permission name", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiToken(taker, { permissions: ["not_a_real_permission"] }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when neither clientID nor permissions are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_CreateApiToken(taker, {})).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CREATE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── clientID path ─────────────────────────────────────────────────────────

	it("throws 404 when the clientID does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiToken(taker, { clientID: "CXNonExistent" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("writes a BAD action row when the clientID does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_CreateApiToken(taker, { clientID: "CXNonExistent" })).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CREATE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("returns { wasExisting: true } and the existing token when one already exists for this client", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId });
		await seedApiToken({ token: "EXISTING_TOKEN", userId, fromClient: "CXTestClient" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		expect(result).toEqual({ token: "EXISTING_TOKEN", wasExisting: true });
	});

	it("does not create a second token when one already exists for this client", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId });
		await seedApiToken({ token: "EXISTING_TOKEN", userId, fromClient: "CXTestClient" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		const tokens = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("user_id", "=", userId)
			.where("from_oauth2_client", "=", "CXTestClient")
			.execute();

		expect(tokens).toHaveLength(1);
	});

	it("creates a new token from the client and returns { wasExisting: false }", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		expect(result.wasExisting).toBe(false);
		expect(result.token).toMatch(/^[0-9a-f]{40}$/u);
	});

	it("copies the client's permissions onto the new token", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId, submitScore: true });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		const row = await getApiToken(token);

		expect(row?.pm_submit_score).toBe(true);
		expect(row?.pm_customise_profile).toBeNull();
	});

	it("sets the token's identifier to the client's name", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId, name: "My App" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		const row = await getApiToken(token);

		expect(row?.identifier).toBe("My App");
	});

	it("sets from_oauth2_client to the clientID on the new token", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		const row = await getApiToken(token);

		expect(row?.from_oauth2_client).toBe("CXTestClient");
	});

	// ── permissions path ──────────────────────────────────────────────────────

	it("creates a token with the specified permissions", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, {
			permissions: ["submit_score", "customise_profile"],
		});

		const row = await getApiToken(token);

		expect(row?.pm_submit_score).toBe(true);
		expect(row?.pm_customise_profile).toBe(true);
		expect(row?.pm_manage_rivals).toBeNull();
	});

	it("sets from_oauth2_client to null for a permissions-based token", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, { permissions: ["submit_score"] });

		const row = await getApiToken(token);

		expect(row?.from_oauth2_client).toBeNull();
	});

	it("uses 'Custom Token' as the identifier when none is provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, { permissions: ["submit_score"] });

		const row = await getApiToken(token);

		expect(row?.identifier).toBe("Custom Token");
	});

	it("uses the provided identifier when given", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const { token } = await ACTION_CreateApiToken(taker, {
			permissions: ["submit_score"],
			identifier: "My Custom Key",
		});

		const row = await getApiToken(token);

		expect(row?.identifier).toBe("My Custom Key");
	});

	it("returns { wasExisting: false } for a permissions-based token", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiToken(taker, { permissions: ["submit_score"] });

		expect(result.wasExisting).toBe(false);
	});

	it("generates a token string matching the expected format", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiToken(taker, { permissions: ["submit_score"] });

		expect(result.token).toMatch(/^[0-9a-f]{40}$/u);
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not return another user's existing client token as their own", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedApiClient({ clientId: "CXTestClient", authorId: other.id });
		await seedApiToken({ token: "OTHER_TOKEN", userId: other.id, fromClient: "CXTestClient" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		expect(result.token).not.toBe("OTHER_TOKEN");
		expect(result.wasExisting).toBe(false);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success (permissions path)", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_CreateApiToken(taker, { permissions: ["submit_score"] });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CREATE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CREATE_API_TOKEN",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a GOOD action row on success (clientID path)", async () => {
		await seedApiClient({ clientId: "CXTestClient", authorId: userId });
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_CreateApiToken(taker, { clientID: "CXTestClient" });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CREATE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CREATE_API_TOKEN",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
