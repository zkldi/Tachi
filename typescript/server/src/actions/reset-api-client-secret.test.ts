import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_ResetApiClientSecret } from "./reset-api-client-secret";
import { seedApiClient } from "./test-utils/api-tokens";

// ─── ACTION_ResetApiClientSecret ──────────────────────────────────────────────

describe("ACTION_ResetApiClientSecret", () => {
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
			ACTION_ResetApiClientSecret(taker, { clientID: "CINonExistent" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 403 when the taker is not the client owner", async () => {
		const { id: otherId, username: otherUsername } = await seedUser({ username: "other_user" });
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherUsername } };

		await expect(
			ACTION_ResetApiClientSecret(taker, { clientID: clientId }),
		).rejects.toMatchObject({ code: 403 });
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("generates a new secret different from the original", async () => {
		const originalRow = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		const updatedRow = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(updatedRow.client_secret).not.toBe(originalRow.client_secret);
	});

	it("new secret matches CS prefix format", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		const result = await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		expect(result.clientSecret).toMatch(/^CS[0-9a-f]{40}$/u);
	});

	it("persists the new secret to the database", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		const result = await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		const row = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.client_secret).toBe(result.clientSecret);
	});

	it("returns the full updated client document", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		const result = await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		expect(result.clientID).toBe(clientId);
		expect(result.author).toBe(userId);
		expect(result.clientSecret).toMatch(/^CS[0-9a-f]{40}$/u);
	});

	it("does not invalidate existing tokens for the client", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await DB.insertInto("priv_api_token")
			.values({
				token: "T_existing_token",
				user_id: userId,
				identifier: "Test Token",
				from_oauth2_client: clientId,
				pm_submit_score: null,
				pm_customise_profile: null,
				pm_customise_score: null,
				pm_customise_session: null,
				pm_delete_score: null,
				pm_manage_rivals: null,
				pm_manage_targets: null,
				pm_manage_challenges: null,
			})
			.execute();

		await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		const tokenStillExists = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("token", "=", "T_existing_token")
			.executeTakeFirst();

		expect(tokenStillExists).toBeDefined();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_ResetApiClientSecret(taker, { clientID: clientId });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "RESET_API_CLIENT_SECRET")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "RESET_API_CLIENT_SECRET",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when client does not exist", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_ResetApiClientSecret(taker, { clientID: "CINonExistent" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "RESET_API_CLIENT_SECRET")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
