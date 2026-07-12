import { seedApiClient, seedApiToken } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

// ─── GET /api/v1/clients ──────────────────────────────────────────────────────

describe("GET /api/v1/clients", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.get("/api/v1/clients");

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 with empty array when user has no clients", async () => {
		const res = await mockApi.get("/api/v1/clients").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual([]);
	});

	it("returns only the authenticated user's clients", async () => {
		await seedApiClient({ clientId: "CIOwn", authorId: userId, name: "My Client" });

		const { id: otherId } = await seedUser({ username: "other_user" });
		await seedApiClient({ clientId: "CIOther", authorId: otherId, name: "Other Client" });

		const res = await mockApi.get("/api/v1/clients").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].clientID).toBe("CIOwn");
	});

	it("includes clientSecret in the response (owner view)", async () => {
		await seedApiClient({ clientId: "CIOwn", authorId: userId });

		const res = await mockApi.get("/api/v1/clients").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body[0].clientSecret).toBeDefined();
		expect(res.body.body[0].clientSecret).not.toBe("");
	});
});

// ─── POST /api/v1/clients/create ─────────────────────────────────────────────

describe("POST /api/v1/clients/create", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.post("/api/v1/clients/create").send({
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: ["submit_score"],
		});

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when name is missing", async () => {
		const res = await mockApi
			.post("/api/v1/clients/create")
			.set("Cookie", cookie)
			.send({ permissions: ["submit_score"] });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when permissions array is empty", async () => {
		const res = await mockApi.post("/api/v1/clients/create").set("Cookie", cookie).send({
			name: "My App",
			redirectUri: null,
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
			permissions: [],
		});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 for invalid permission names", async () => {
		const res = await mockApi
			.post("/api/v1/clients/create")
			.set("Cookie", cookie)
			.send({
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["not_valid"],
			});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when apiKeyTemplate is missing %%TACHI_KEY%%", async () => {
		const res = await mockApi
			.post("/api/v1/clients/create")
			.set("Cookie", cookie)
			.send({
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: "no-placeholder-here",
				apiKeyFilename: null,
				permissions: ["submit_score"],
			});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("creates a client and returns 200 with its data", async () => {
		const res = await mockApi
			.post("/api/v1/clients/create")
			.set("Cookie", cookie)
			.send({
				name: "My App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			});

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.name).toBe("My App");
		expect(res.body.body.clientID).toMatch(/^CI[0-9a-f]{40}$/u);
		expect(res.body.body.clientSecret).toMatch(/^CS[0-9a-f]{40}$/u);
		expect(res.body.body.author).toBe(userId);
	});

	it("persists the new client to the database", async () => {
		const res = await mockApi
			.post("/api/v1/clients/create")
			.set("Cookie", cookie)
			.send({
				name: "Persistent App",
				redirectUri: null,
				webhookUri: null,
				apiKeyTemplate: null,
				apiKeyFilename: null,
				permissions: ["submit_score"],
			});

		expect(res.status).toBe(200);

		const row = await DB.selectFrom("priv_api_client")
			.select(["client_id", "name"])
			.where("client_id", "=", res.body.body.clientID)
			.executeTakeFirst();

		expect(row?.name).toBe("Persistent App");
	});
});

// ─── GET /api/v1/clients/:clientID ───────────────────────────────────────────

describe("GET /api/v1/clients/:clientID", () => {
	let userId: number;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId } = await seedUser({ username: "test_user" }));
		clientId = await seedApiClient({
			clientId: "CITestClient",
			authorId: userId,
			name: "Test Client",
		});
	});

	it("returns 404 for a non-existent client", async () => {
		const res = await mockApi.get("/api/v1/clients/CINonExistent");

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 with client data (no clientSecret)", async () => {
		const res = await mockApi.get(`/api/v1/clients/${clientId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.clientID).toBe(clientId);
		expect(res.body.body.name).toBe("Test Client");
		expect(res.body.body.clientSecret).toBeUndefined();
	});

	it("is accessible without authentication", async () => {
		const res = await mockApi.get(`/api/v1/clients/${clientId}`);

		expect(res.status).toBe(200);
	});
});

// ─── PATCH /api/v1/clients/:clientID ─────────────────────────────────────────

describe("PATCH /api/v1/clients/:clientID", () => {
	/** Prudence `?string` fields - omit vs null is not optional; send null when not updating. */
	const nullTemplateAndUris = {
		apiKeyTemplate: null,
		redirectUri: null,
		webhookUri: null,
	} as const;

	let cookie: string[];
	let userId: number;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
		clientId = await seedApiClient({
			clientId: "CITestClient",
			authorId: userId,
			name: "Old Name",
		});
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi
			.patch(`/api/v1/clients/${clientId}`)
			.send({ name: "New Name", ...nullTemplateAndUris });

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 404 for a non-existent client", async () => {
		const res = await mockApi
			.patch("/api/v1/clients/CINonExistent")
			.set("Cookie", cookie)
			.send({ name: "New Name", ...nullTemplateAndUris });

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when authenticated user does not own the client", async () => {
		const { id: otherId } = await seedUser({
			username: "other_user",
			email: "other_user@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiClient({ clientId: "CIOther", authorId: otherId, name: "Other" });
		const otherCookie = await loginAs("other_user");

		const res = await mockApi
			.patch(`/api/v1/clients/${clientId}`)
			.set("Cookie", otherCookie)
			.send({ name: "Hijacked", ...nullTemplateAndUris });

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when no fields are provided", async () => {
		const res = await mockApi
			.patch(`/api/v1/clients/${clientId}`)
			.set("Cookie", cookie)
			.send({});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 and updated client when name is changed", async () => {
		const res = await mockApi
			.patch(`/api/v1/clients/${clientId}`)
			.set("Cookie", cookie)
			.send({ name: "New Name", ...nullTemplateAndUris });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.name).toBe("New Name");
	});

	it("persists the name change to the database", async () => {
		await mockApi
			.patch(`/api/v1/clients/${clientId}`)
			.set("Cookie", cookie)
			.send({ name: "Persisted Name", ...nullTemplateAndUris });

		const row = await DB.selectFrom("priv_api_client")
			.select("name")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(row.name).toBe("Persisted Name");
	});

	it("returns 400 when apiKeyTemplate is missing %%TACHI_KEY%%", async () => {
		const res = await mockApi.patch(`/api/v1/clients/${clientId}`).set("Cookie", cookie).send({
			apiKeyTemplate: "no-placeholder",
			redirectUri: null,
			webhookUri: null,
		});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});
});

// ─── POST /api/v1/clients/:clientID/reset-secret ─────────────────────────────

describe("POST /api/v1/clients/:clientID/reset-secret", () => {
	let cookie: string[];
	let userId: number;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
		clientId = await seedApiClient({ clientId: "CITestClient", authorId: userId });
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.post(`/api/v1/clients/${clientId}/reset-secret`);

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 404 for a non-existent client", async () => {
		const res = await mockApi
			.post("/api/v1/clients/CINonExistent/reset-secret")
			.set("Cookie", cookie);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when authenticated user does not own the client", async () => {
		const { id: otherId } = await seedUser({
			username: "other_user",
			email: "other_user@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiClient({ clientId: "CIOther", authorId: otherId });
		const otherCookie = await loginAs("other_user");

		const res = await mockApi
			.post(`/api/v1/clients/${clientId}/reset-secret`)
			.set("Cookie", otherCookie);

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 with the updated client including a new secret", async () => {
		const res = await mockApi
			.post(`/api/v1/clients/${clientId}/reset-secret`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.clientSecret).toMatch(/^CS[0-9a-f]{40}$/u);
	});

	it("persists the new secret to the database", async () => {
		const before = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		const res = await mockApi
			.post(`/api/v1/clients/${clientId}/reset-secret`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const after = await DB.selectFrom("priv_api_client")
			.select("client_secret")
			.where("client_id", "=", clientId)
			.executeTakeFirstOrThrow();

		expect(after.client_secret).not.toBe(before.client_secret);
		expect(after.client_secret).toBe(res.body.body.clientSecret);
	});

	it("does not remove existing tokens for the client", async () => {
		await seedApiToken({ token: "T_should_survive", userId, fromClient: clientId });

		await mockApi.post(`/api/v1/clients/${clientId}/reset-secret`).set("Cookie", cookie);

		const token = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("token", "=", "T_should_survive")
			.executeTakeFirst();

		expect(token).toBeDefined();
	});
});

// ─── DELETE /api/v1/clients/:clientID ────────────────────────────────────────

describe("DELETE /api/v1/clients/:clientID", () => {
	let cookie: string[];
	let userId: number;
	let clientId: string;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
		clientId = await seedApiClient({ clientId: "CITestClient", authorId: userId });
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.delete(`/api/v1/clients/${clientId}`);

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 404 for a non-existent client", async () => {
		const res = await mockApi.delete("/api/v1/clients/CINonExistent").set("Cookie", cookie);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when authenticated user does not own the client", async () => {
		const { id: otherId } = await seedUser({
			username: "other_user",
			email: "other_user@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiClient({ clientId: "CIOther", authorId: otherId });
		const otherCookie = await loginAs("other_user");

		const res = await mockApi.delete(`/api/v1/clients/${clientId}`).set("Cookie", otherCookie);

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 and removes the client", async () => {
		const res = await mockApi.delete(`/api/v1/clients/${clientId}`).set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const row = await DB.selectFrom("priv_api_client")
			.select("client_id")
			.where("client_id", "=", clientId)
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});

	it("removes all api tokens associated with the deleted client", async () => {
		await seedApiToken({ token: "T_linked_token", userId, fromClient: clientId });

		await mockApi.delete(`/api/v1/clients/${clientId}`).set("Cookie", cookie);

		const token = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("token", "=", "T_linked_token")
			.executeTakeFirst();

		expect(token).toBeUndefined();
	});

	it("does not remove tokens belonging to other clients", async () => {
		const { id: otherId } = await seedUser({ username: "other_user" });
		await seedApiClient({ clientId: "CIOther", authorId: otherId });
		await seedApiToken({ token: "T_other_token", userId: otherId, fromClient: "CIOther" });

		await mockApi.delete(`/api/v1/clients/${clientId}`).set("Cookie", cookie);

		const preserved = await DB.selectFrom("priv_api_token")
			.select("token")
			.where("token", "=", "T_other_token")
			.executeTakeFirst();

		expect(preserved).toBeDefined();
	});
});
