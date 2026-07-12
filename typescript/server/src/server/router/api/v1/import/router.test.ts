import { seedApiToken } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

describe("POST /api/v1/import/from-api", () => {
	it("returns 400 when the import type is not enabled on this instance", async () => {
		const { id: userId } = await seedUser({
			username: "from_api_disabled_type",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "from_api_disabled",
			userId,
			submitScore: true,
		});

		const res = await mockApi
			.post("/api/v1/import/from-api")
			.set("Authorization", "Bearer from_api_disabled")
			.send({ importType: "api/cg-dev-sdvx" });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/not enabled on this instance/iu);
	});

	it("returns 400 for non-API import types", async () => {
		const { id: userId } = await seedUser({
			username: "from_api_wrong_type",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "from_api_wrong",
			userId,
			submitScore: true,
		});

		const res = await mockApi
			.post("/api/v1/import/from-api")
			.set("Authorization", "Bearer from_api_wrong")
			.send({ importType: "file/batch-manual" });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/Invalid import type/iu);
	});
});

describe("import/orphans auth", () => {
	it("returns 403 for unauthenticated GET list", async () => {
		const res = await mockApi.get("/api/v1/import/orphans");
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 for unauthenticated POST reprocess", async () => {
		const res = await mockApi.post("/api/v1/import/orphans").send({});
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 for unauthenticated DELETE", async () => {
		const res = await mockApi.delete("/api/v1/import/orphans/O_ANY");
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 for unauthenticated GET detail", async () => {
		const res = await mockApi.get("/api/v1/import/orphans/O_ANY");
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when API token lacks submit_score", async () => {
		const { id: userId } = await seedUser({
			username: "import_orphan_token_user",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "orphan_no_submit",
			userId,
			submitScore: false,
		});

		const res = await mockApi
			.get("/api/v1/import/orphans")
			.set("Authorization", "Bearer orphan_no_submit");

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/submit_score/iu);
	});
});

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

describe("POST /api/v1/import/orphans", () => {
	it("reprocesses the requesting user's orphan rows from Postgres", async () => {
		const { id: userId } = await seedUser({
			username: "import_orphan_user",
			withCredential: true,
			withSettings: true,
		});
		const cookie = await loginAs("import_orphan_user");

		await DB.insertInto("song")
			.values({
				id: "S_IMP_ORPHAN",
				legacy_id: 1,
				game_group: "iidx",
				title: "5.1.1.",
				artist: "dj nagureo",
				search_terms: [],
				alt_titles: [],
				data: { displayVersion: "1", genre: "PIANO AMBIENT" },
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: "C_IMP_ORPHAN",
				legacy_id: "c2311194e3897ddb5745b1760d2c0141f933e683",
				game: "iidx-sp",
				song_id: "S_IMP_ORPHAN",
				difficulty: "ANOTHER",
				level: "10",
				level_num: 10,
				is_primary: true,
				versions: ["27", "26"],
				data: {
					inGameID: 1000,
					notecount: 786,
					kaidenAverage: null,
					worldRecord: null,
				},
			})
			.execute();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "asdf",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: {
					game: "iidx-sp",
					version: "27",
					service: "foo",
				},
				data: {
					score: 500,
					lamp: "HARD CLEAR",
					matchType: "songTitle",
					identifier: "5.1.1.",
					difficulty: "ANOTHER",
				},
				time_inserted: new Date(1000).toISOString(),
				error_message: "foo",
			})
			.execute();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "asdf2",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: {
					game: "iidx-sp",
					version: "27",
					service: "foo",
				},
				data: {
					score: 500,
					lamp: "HARD CLEAR",
					matchType: "songTitle",
					identifier: "TITLE NOBODY WILL USE",
					difficulty: "ANOTHER",
				},
				time_inserted: new Date(1000).toISOString(),
				error_message: "foo",
			})
			.execute();

		const res = await mockApi.post("/api/v1/import/orphans").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.success).toBe(1);
		expect(res.body.body.processed).toBe(2);
		expect(res.body.body.failed).toBe(1);

		const remaining = await DB.selectFrom("orphan_score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.executeTakeFirstOrThrow();

		expect(Number(remaining.c)).toBe(1);
	});
});

describe("GET /api/v1/import/orphans", () => {
	it("returns the authenticated user’s orphan rows with pagination", async () => {
		const { id: userId } = await seedUser({
			username: "import_orphan_list_user",
			withCredential: true,
			withSettings: true,
		});
		const cookie = await loginAs("import_orphan_list_user");

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "O_LIST_A",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: { game: "iidx-sp", version: "27", service: "foo" },
				data: { identifier: "Song A", score: 100 },
				time_inserted: new Date(2_000).toISOString(),
				error_message: "err-a",
			})
			.execute();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "O_LIST_B",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: { game: "iidx-sp", version: "27", service: "foo" },
				data: { identifier: "Song B", score: 200 },
				time_inserted: new Date(3_000).toISOString(),
				error_message: "",
			})
			.execute();

		const first = await mockApi
			.get("/api/v1/import/orphans")
			.query({ limit: 1 })
			.set("Cookie", cookie);

		expect(first.status).toBe(200);
		expect(first.body.success).toBe(true);
		expect(first.body.body.orphans).toHaveLength(1);
		expect(first.body.body.hasMore).toBe(true);
		expect(first.body.body.orphans[0].orphanID).toBe("O_LIST_B");
		expect(first.body.body.orphans[0].summary).toBe("Song B");

		const rowID = first.body.body.orphans[0].rowID as string;

		const second = await mockApi
			.get("/api/v1/import/orphans")
			.query({ limit: 10, after: rowID })
			.set("Cookie", cookie);

		expect(second.status).toBe(200);
		expect(
			second.body.body.orphans.some((o: { orphanID: string }) => o.orphanID === "O_LIST_A"),
		).toBe(true);
	});

	it("returns one orphan with raw data and context", async () => {
		const { id: userId } = await seedUser({
			username: "import_orphan_detail_user",
			withCredential: true,
			withSettings: true,
		});
		const cookie = await loginAs("import_orphan_detail_user");

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "O_DETAIL_1",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: { game: "iidx-sp", version: "27" },
				data: { identifier: "Song X", score: 300 },
				time_inserted: new Date(4_000).toISOString(),
				error_message: "not-found",
			})
			.execute();

		const res = await mockApi.get("/api/v1/import/orphans/O_DETAIL_1").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.orphanID).toBe("O_DETAIL_1");
		expect(res.body.body.importType).toBe("ir/direct-manual");
		expect(res.body.body.gameGroup).toBe("iidx");
		expect(res.body.body.message).toBe("not-found");
		expect(res.body.body.data).toEqual({ identifier: "Song X", score: 300 });
		expect(res.body.body.context).toEqual({ game: "iidx-sp", version: "27" });
	});

	it("returns 404 for another user’s orphan on GET detail", async () => {
		const { id: ownerId } = await seedUser({
			username: "import_orphan_detail_owner",
			email: "import_orphan_detail_owner@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "import_orphan_detail_other",
			email: "import_orphan_detail_other@example.com",
			withCredential: true,
			withSettings: true,
		});
		const otherCookie = await loginAs("import_orphan_detail_other");

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "O_DETAIL_OTHER",
				user_id: ownerId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: {},
				data: {},
				time_inserted: new Date().toISOString(),
				error_message: "",
			})
			.execute();

		const res = await mockApi
			.get("/api/v1/import/orphans/O_DETAIL_OTHER")
			.set("Cookie", otherCookie);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});
});

describe("DELETE /api/v1/import/orphans/:orphanID", () => {
	it("deletes only the caller’s orphan row", async () => {
		const { id: userId } = await seedUser({
			username: "import_orphan_del_user",
			withCredential: true,
			withSettings: true,
		});
		const cookie = await loginAs("import_orphan_del_user");

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "O_DEL_ME",
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				context: {},
				data: {},
				time_inserted: new Date().toISOString(),
				error_message: "",
			})
			.execute();

		const res = await mockApi.delete("/api/v1/import/orphans/O_DEL_ME").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const again = await mockApi.delete("/api/v1/import/orphans/O_DEL_ME").set("Cookie", cookie);
		expect(again.status).toBe(404);
	});
});
