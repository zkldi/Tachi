import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_InstallBuiltinClient } from "./install-builtin-client";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PERMISSIONS = {
	customise_profile: false,
	customise_score: false,
	customise_session: false,
	delete_score: false,
	manage_rivals: false,
	manage_targets: false,
	submit_score: true,
	manage_challenges: false,
};

const BASE_INPUT = {
	clientID: "CXTestClient",
	name: "Test Client",
	permissions: BASE_PERMISSIONS,
	apiKeyFilename: "test-client.json",
	apiKeyTemplate: '{"token": "%%TACHI_KEY%%"}',
	webhookUri: null,
	redirectUri: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ACTION_InstallBuiltinClient", () => {
	let adminId: number;
	let userId: number;

	beforeEach(async () => {
		const admin = await seedUser({ username: "admin_user", authLevel: "admin" });
		adminId = admin.id;

		const user = await seedUser({ username: "regular_user" });
		userId = user.id;
	});

	// ── Authorization ──────────────────────────────────────────────────────────

	it("throws with code 403 when the taker is not an admin", async () => {
		const taker = { ip: null, acct: { id: userId, username: "regular_user" } };

		await expect(ACTION_InstallBuiltinClient(taker, BASE_INPUT)).rejects.toMatchObject({
			code: 403,
		});
	});

	it("writes a BAD action row when the taker is not an admin", async () => {
		const taker = { ip: null, acct: { id: userId, username: "regular_user" } };

		await expect(ACTION_InstallBuiltinClient(taker, BASE_INPUT)).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "INSTALL_BUILTIN_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not insert a client when the taker is not an admin", async () => {
		const taker = { ip: null, acct: { id: userId, username: "regular_user" } };

		await expect(ACTION_InstallBuiltinClient(taker, BASE_INPUT)).rejects.toThrow();

		const clients = await DB.selectFrom("priv_api_client")
			.select("client_id")
			.where("client_id", "=", BASE_INPUT.clientID)
			.execute();

		expect(clients).toHaveLength(0);
	});

	// ── Success path ───────────────────────────────────────────────────────────

	it("returns an empty object on success", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		const result = await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		expect(result).toEqual({});
	});

	it("inserts the client with the correct fields", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		const client = await DB.selectFrom("priv_api_client")
			.selectAll()
			.where("client_id", "=", BASE_INPUT.clientID)
			.executeTakeFirst();

		expect(client).toMatchObject({
			client_id: "CXTestClient",
			name: "Test Client",
			author: adminId,
			pm_submit_score: true,
			pm_customise_profile: false,
			pm_customise_score: false,
			pm_customise_session: false,
			pm_delete_score: false,
			pm_manage_rivals: false,
			pm_manage_targets: false,
			pm_manage_challenges: false,
			api_key_filename: "test-client.json",
			api_key_template: '{"token": "%%TACHI_KEY%%"}',
			webhook_uri: null,
			redirect_uri: null,
		});
	});

	it("always marks the client as is_builtin: true", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		const client = await DB.selectFrom("priv_api_client")
			.select("is_builtin")
			.where("client_id", "=", BASE_INPUT.clientID)
			.executeTakeFirstOrThrow();

		expect(client.is_builtin).toBe(true);
	});

	it("generates a non-empty client secret", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		const client = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", BASE_INPUT.clientID)
			.executeTakeFirstOrThrow();

		expect(client.client_secret).toMatch(/^CS[0-9a-f]{40}$/u);
	});

	it("stores null for optional fields when they are not provided", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, {
			...BASE_INPUT,
			apiKeyFilename: null,
			apiKeyTemplate: null,
			webhookUri: null,
			redirectUri: null,
		});

		const client = await DB.selectFrom("priv_api_client")
			.selectAll()
			.where("client_id", "=", BASE_INPUT.clientID)
			.executeTakeFirstOrThrow();

		expect(client.api_key_filename).toBeNull();
		expect(client.api_key_template).toBeNull();
		expect(client.webhook_uri).toBeNull();
		expect(client.redirect_uri).toBeNull();
	});

	// ── Upsert behaviour ───────────────────────────────────────────────────────

	it("updates the existing row when called again with the same clientID", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);
		await ACTION_InstallBuiltinClient(taker, { ...BASE_INPUT, name: "Updated Name" });

		const clients = await DB.selectFrom("priv_api_client")
			.select(["client_id", "name"])
			.where("client_id", "=", BASE_INPUT.clientID)
			.execute();

		expect(clients).toHaveLength(1);
		expect(clients[0]?.name).toBe("Updated Name");
	});

	it("uses the new author on upsert", async () => {
		const first = await seedUser({ username: "first_admin", authLevel: "admin" });
		const second = await seedUser({ username: "second_admin", authLevel: "admin" });

		await ACTION_InstallBuiltinClient(
			{ ip: null, acct: { id: first.id, username: first.username } },
			BASE_INPUT,
		);

		await ACTION_InstallBuiltinClient(
			{ ip: null, acct: { id: second.id, username: second.username } },
			BASE_INPUT,
		);

		const client = await DB.selectFrom("priv_api_client")
			.select("author")
			.where("client_id", "=", BASE_INPUT.clientID)
			.executeTakeFirstOrThrow();

		expect(client.author).toBe(second.id);
	});

	// ── Audit log ──────────────────────────────────────────────────────────────

	it("writes a GOOD action row to the audit log on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "INSTALL_BUILTIN_CLIENT")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			app: "TACHI_SERVER",
			kind: "INSTALL_BUILTIN_CLIENT",
			result: "GOOD",
			user_id: adminId,
			ip: "10.0.0.1",
		});
	});

	it("includes the client details in the audit log input", async () => {
		const taker = { ip: null, acct: { id: adminId, username: "admin_user" } };

		await ACTION_InstallBuiltinClient(taker, BASE_INPUT);

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "INSTALL_BUILTIN_CLIENT")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).toMatchObject({
			clientID: BASE_INPUT.clientID,
			name: BASE_INPUT.name,
		});
	});
});
