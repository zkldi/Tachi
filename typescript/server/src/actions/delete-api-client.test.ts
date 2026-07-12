import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_DeleteApiClient } from "./delete-api-client";
import { seedApiClient, seedApiToken } from "./test-utils/api-tokens";

// ─── ACTION_DeleteApiClient ───────────────────────────────────────────────────

describe("ACTION_DeleteApiClient", () => {
	let userId: number;
	let username: string;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
		clientId = await seedApiClient({ clientId: "CITestClient", authorId: userId });
	});

	// ── Existence / ownership ─────────────────────────────────────────────────

	it("throws 404 when the client does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_DeleteApiClient(taker, { clientID: "CINonExistent" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 403 when the taker is not the client owner", async () => {
		const { id: otherId, username: otherUsername } = await seedUser({ username: "other_user" });
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherUsername } };

		await expect(ACTION_DeleteApiClient(taker, { clientID: clientId })).rejects.toMatchObject({
			code: 403,
		});
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("removes the client from priv_api_client", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiClient(taker, { clientID: clientId });

		const row = await DB.selectFrom("priv_api_client")
			.select("client_id")
			.where("client_id", "=", clientId)
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});

	it("removes all api tokens associated with this client", async () => {
		await seedApiToken({ token: "T_token_1", userId, fromClient: clientId });
		await seedApiToken({ token: "T_token_2", userId, fromClient: clientId });

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiClient(taker, { clientID: clientId });

		const remaining = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("from_oauth2_client", "=", clientId)
			.execute();

		expect(remaining).toHaveLength(0);
	});

	it("does not remove tokens belonging to other clients", async () => {
		const { id: otherId } = await seedUser({ username: "other_user" });
		await seedApiClient({ clientId: "CIOtherClient", authorId: otherId });
		await seedApiToken({
			token: "T_other_token",
			userId: otherId,
			fromClient: "CIOtherClient",
		});

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiClient(taker, { clientID: clientId });

		const preserved = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("token", "=", "T_other_token")
			.executeTakeFirst();

		expect(preserved).toBeDefined();
	});

	it("succeeds and returns {} when the client has no tokens", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteApiClient(taker, { clientID: clientId });

		expect(result).toEqual({});
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiClient(taker, { clientID: clientId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_API_CLIENT",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when client does not exist", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_DeleteApiClient(taker, { clientID: "CINonExistent" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "DELETE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
