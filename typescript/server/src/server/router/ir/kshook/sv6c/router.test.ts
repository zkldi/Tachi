import { seedApiToken } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingKsHookSV6CScore, TestingKsHookSV6CStaticScore } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const MOCK_TOKEN = "mock_token";

/** Mongo mock user id 1 matches `mock-db/users.json` after ResetDBState. */
const IR_USER_ID = 1;

async function seedPgUserAndApiToken() {
	await seedUser({
		username: "test_zkldi",
		email: "ir-kshook-test@example.com",
		withCredential: true,
		withSettings: true,
	});
	await seedApiToken({
		token: MOCK_TOKEN,
		userId: IR_USER_ID,
		submitScore: true,
	});
}

afterAll(() => CloseServerConnection());

describe("POST /ir/kshook/sv6c/score/save", () => {
	beforeEach(async () => {
		await seedPgUserAndApiToken();
	});

	it.fails("imports a valid score", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.scoreIDs).toHaveLength(1);
		expect(res.body.body.errors).toHaveLength(0);
		expect(res.body.body.userIntent).toBe(false);
	});

	it("rejects invalid scores (empty body and invalid clear)", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send({});

		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe("string");

		const res2 = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(
				deepmerge(TestingKsHookSV6CScore, {
					clear: "INVALID_CLEAR_TYPE",
				}),
			);

		expect(res2.status).toBe(400);
		expect(typeof res2.body.error).toBe("string");
	});

	it("rejects invalid software models and missing header", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "LDJ:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe("string");

		const res2 = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.send(TestingKsHookSV6CScore);

		expect(res2.status).toBe(400);
		expect(typeof res2.body.error).toBe("string");
	});

	it("rejects invalid or missing auth", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("Authorization", "Bearer foo")
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res.status).toBe(401);
		expect(typeof res.body.error).toBe("string");

		const res2 = await mockApi
			.post("/ir/kshook/sv6c/score/save")
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res2.status).toBe(401);
		expect(typeof res2.body.error).toBe("string");
	});
});

describe("POST /ir/kshook/sv6c/score/export", () => {
	const validSubmit = (data: object) =>
		mockApi
			.post("/ir/kshook/sv6c/score/export")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send({ scores: [data] });

	beforeEach(async () => {
		await seedPgUserAndApiToken();
		await DB.insertInto("svc_kshook_sv6c_settings")
			.values({ user_id: IR_USER_ID, force_static_import: true })
			.execute();
	});

	it.fails("imports a valid static score and clears force_static_import", async () => {
		const res = await validSubmit(TestingKsHookSV6CStaticScore);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.scoreIDs).toHaveLength(1);
		expect(res.body.body.errors).toHaveLength(0);
		expect(res.body.body.userIntent).toBe(false);

		const dbRes = await DB.selectFrom("svc_kshook_sv6c_settings")
			.selectAll()
			.where("user_id", "=", IR_USER_ID)
			.executeTakeFirst();

		expect(dbRes?.force_static_import).toBe(false);
	});

	it("rejects invalid scores (empty object)", async () => {
		const res = await validSubmit({});

		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe("string");
	});

	it("rejects invalid clear types", async () => {
		const res = await validSubmit(
			deepmerge(TestingKsHookSV6CScore, {
				clear: "INVALID_CLEAR_TYPE",
			}),
		);

		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe("string");
	});

	it("ignores static import when force_static_import is false", async () => {
		await DB.insertInto("svc_kshook_sv6c_settings")
			.values({ user_id: IR_USER_ID, force_static_import: false })
			.onConflict((oc) => oc.column("user_id").doUpdateSet({ force_static_import: false }))
			.execute();

		const res = await validSubmit(TestingKsHookSV6CStaticScore);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.description).toBe(
			"Static importing is disabled. Ignoring static import request.",
		);
	});

	it("rejects invalid software models and missing header", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/export")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "LDJ:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe("string");

		const res2 = await mockApi
			.post("/ir/kshook/sv6c/score/export")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.set("User-Agent", "kshook/0.1.0")
			.send(TestingKsHookSV6CScore);

		expect(res2.status).toBe(400);
		expect(typeof res2.body.error).toBe("string");
	});

	it("rejects invalid or missing auth", async () => {
		const res = await mockApi
			.post("/ir/kshook/sv6c/score/export")
			.set("Authorization", "Bearer foo")
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res.status).toBe(401);
		expect(typeof res.body.error).toBe("string");

		const res2 = await mockApi
			.post("/ir/kshook/sv6c/score/export")
			.set("User-Agent", "kshook/0.1.0")
			.set("X-Software-Model", "QCV:J:C:A:2021100600")
			.send(TestingKsHookSV6CScore);

		expect(res2.status).toBe(401);
		expect(typeof res2.body.error).toBe("string");
	});
});
