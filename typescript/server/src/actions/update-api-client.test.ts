import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { seedApiClient } from "./test-utils/api-tokens";
import { ACTION_UpdateApiClient } from "./update-api-client";

// ─── ACTION_UpdateApiClient ───────────────────────────────────────────────────

describe("ACTION_UpdateApiClient", () => {
	let userId: number;
	let username: string;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
		clientId = await seedApiClient({
			clientId: "CITestClient",
			authorId: userId,
			name: "Old Name",
		});
	});

	// ── Existence / ownership ─────────────────────────────────────────────────

	it("throws 404 when the client does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, { clientID: "CINonExistent", name: "New Name" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 403 when the taker is not the client owner", async () => {
		const { id: otherId, username: otherUsername } = await seedUser({ username: "other_user" });
		const taker = { ip: "127.0.0.1", acct: { id: otherId, username: otherUsername } };

		await expect(
			ACTION_UpdateApiClient(taker, { clientID: clientId, name: "Hijacked" }),
		).rejects.toMatchObject({ code: 403 });
	});

	// ── Input validation ──────────────────────────────────────────────────────

	it("throws 400 when no fields are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateApiClient(taker, { clientID: clientId })).rejects.toMatchObject({
			code: 400,
		});
	});

	it("throws 400 when apiKeyTemplate does not contain %%TACHI_KEY%%", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, {
				clientID: clientId,
				apiKeyTemplate: "missing-placeholder",
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri uses http instead of https", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, {
				clientID: clientId,
				webhookUri: "http://example.com/webhook",
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri targets a private IP address", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, {
				clientID: clientId,
				webhookUri: "https://10.0.0.1:8080/internal",
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri targets localhost", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, {
				clientID: clientId,
				webhookUri: "https://localhost/webhook",
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("allows setting webhookUri to null", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			webhookUri: null,
		});

		expect(result.webhookUri).toBeNull();
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("updates the name field", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			name: "New Name",
		});

		expect(result.name).toBe("New Name");

		const row = await DB.selectFrom("priv_api_client")
			.select("name")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.name).toBe("New Name");
	});

	it("updates redirectUri", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			redirectUri: "https://example.com/callback",
		});

		const row = await DB.selectFrom("priv_api_client")
			.select("redirect_uri")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.redirect_uri).toBe("https://example.com/callback");
	});

	it("sets redirectUri to null", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, { clientID: clientId, redirectUri: null });

		const row = await DB.selectFrom("priv_api_client")
			.select("redirect_uri")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.redirect_uri).toBeNull();
	});

	it("updates webhookUri", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			webhookUri: "https://example.com/webhook",
		});

		const row = await DB.selectFrom("priv_api_client")
			.select("webhook_uri")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.webhook_uri).toBe("https://example.com/webhook");
	});

	it("updates apiKeyTemplate when it contains %%TACHI_KEY%%", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			apiKeyTemplate: "key=%%TACHI_KEY%%",
		});

		const row = await DB.selectFrom("priv_api_client")
			.select("api_key_template")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.api_key_template).toBe("key=%%TACHI_KEY%%");
	});

	it("clears apiKeyTemplate when set to null", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, { clientID: clientId, apiKeyTemplate: null });

		const row = await DB.selectFrom("priv_api_client")
			.select("api_key_template")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.api_key_template).toBeNull();
	});

	it("updates apiKeyFilename", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, { clientID: clientId, apiKeyFilename: "keys.txt" });

		const row = await DB.selectFrom("priv_api_client")
			.select("api_key_filename")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.api_key_filename).toBe("keys.txt");
	});

	it("returns the updated client document", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateApiClient(taker, {
			clientID: clientId,
			name: "Updated Name",
		});

		expect(result.clientID).toBe(clientId);
		expect(result.name).toBe("Updated Name");
		expect(result.author).toBe(userId);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateApiClient(taker, { clientID: clientId, name: "New Name" });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_API_CLIENT",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when client does not exist", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_UpdateApiClient(taker, { clientID: "CINonExistent", name: "New Name" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "UPDATE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
