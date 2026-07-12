import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_CreateApiClient } from "./create-api-client";
import { seedApiClient } from "./test-utils/api-tokens";

// ─── ACTION_CreateApiClient ───────────────────────────────────────────────────

describe("ACTION_CreateApiClient", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Input validation ──────────────────────────────────────────────────────

	it("throws 400 when permissions list is empty", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: [],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 for an invalid permission name", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["not_a_real_permission"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri uses http instead of https", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: "http://example.com/webhook",
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri targets localhost", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: "https://localhost/webhook",
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri targets a private IP address", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: "https://10.0.0.1/webhook",
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when webhookUri targets a link-local address", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: "https://169.254.169.254/latest/meta-data/",
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when apiKeyTemplate does not contain %%TACHI_KEY%%", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: "missing-the-placeholder",
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	// ── Client cap ────────────────────────────────────────────────────────────

	it("throws 400 when user has reached OAUTH_CLIENT_CAP", async () => {
		for (let i = 0; i < ServerConfig.OAUTH_CLIENT_CAP; i++) {
			await seedApiClient({ clientId: `CI_test_${i}`, authorId: userId });
		}

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "One Too Many",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("does not apply the cap to admin users", async () => {
		const { id: adminId, username: adminUsername } = await seedUser({
			username: "admin_user",
			authLevel: "admin",
		});

		for (let i = 0; i < ServerConfig.OAUTH_CLIENT_CAP; i++) {
			await seedApiClient({ clientId: `CI_admin_${i}`, authorId: adminId });
		}

		const taker = { ip: "127.0.0.1", acct: { id: adminId, username: adminUsername } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "Admin Extra Client",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			}),
		).resolves.toMatchObject({ name: "Admin Extra Client" });
	});

	// ── Happy path ────────────────────────────────────────────────────────────

	it("inserts a row into priv_api_client", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		const row = await DB.selectFrom("priv_api_client")
			.select(["client_id", "name", "author"])
			.where("client_id", "=", result.clientID)
			.executeTakeFirst();

		expect(row).toBeDefined();
		expect(row?.name).toBe("My App");
		expect(row?.author).toBe(userId);
	});

	it("returns a clientID matching CI prefix and a clientSecret matching CS prefix", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		expect(result.clientID).toMatch(/^CI[0-9a-f]{40}$/u);
		expect(result.clientSecret).toMatch(/^CS[0-9a-f]{40}$/u);
	});

	it("deduplicates permissions", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score", "submit_score", "customise_profile"],
		});

		expect(result.requestedPermissions).toHaveLength(2);
		expect(result.requestedPermissions).toContain("submit_score");
		expect(result.requestedPermissions).toContain("customise_profile");
	});

	it("stores redirect_uri and webhook_uri when provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: "https://example.com/callback",
			webhookUri: "https://example.com/webhook",
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		const row = await DB.selectFrom("priv_api_client")
			.select(["redirect_uri", "webhook_uri"])
			.where("client_id", "=", result.clientID)
			.executeTakeFirstOrThrow();

		expect(row.redirect_uri).toBe("https://example.com/callback");
		expect(row.webhook_uri).toBe("https://example.com/webhook");
	});

	it("stores apiKeyTemplate and apiKeyFilename when provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: "key=%%TACHI_KEY%%",
			apiKeyFilename: "tachi-key.txt",
			permissions: ["submit_score"],
		});

		const row = await DB.selectFrom("priv_api_client")
			.select(["api_key_template", "api_key_filename"])
			.where("client_id", "=", result.clientID)
			.executeTakeFirstOrThrow();

		expect(row.api_key_template).toBe("key=%%TACHI_KEY%%");
		expect(row.api_key_filename).toBe("tachi-key.txt");
	});

	it("sets pm_submit_score when that permission is requested", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		const row = await DB.selectFrom("priv_api_client")
			.select(["pm_submit_score", "pm_customise_profile"])
			.where("client_id", "=", result.clientID)
			.executeTakeFirstOrThrow();

		expect(row.pm_submit_score).toBe(true);
		expect(row.pm_customise_profile).toBeNull();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_CreateApiClient(taker, {
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CREATE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "CREATE_API_CLIENT",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("writes a BAD action row when permissions are invalid", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_CreateApiClient(taker, {
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: [],
			}),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CREATE_API_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});
});
