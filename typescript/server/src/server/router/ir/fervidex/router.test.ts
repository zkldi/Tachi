import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import {
	FervidexBaseGSMScore,
	FervidexBaseScore,
	Testing511Song,
	Testing511SPA,
} from "#test-utils/test-data";
import { Random20Hex } from "#utils/misc";
import deepmerge from "deepmerge";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const ROOTAGE_MODEL = "LDJ:J:B:A:2020092900";
const FER_AGENT = "fervidex/1.3.0";

function ferHeaders(model = ROOTAGE_MODEL) {
	return {
		Authorization: "Bearer mock_token",
		"User-Agent": FER_AGENT,
		"X-Software-Model": model,
	} as const;
}

async function seedUserAndToken() {
	await seedUser({
		username: "test_zkldi",
		email: "fervidex-ir@example.com",
		withCredential: true,
		withSettings: true,
	});
	await seedApiToken({
		token: "mock_token",
		userId: 1,
		submitScore: true,
	});
}

/** IIDX SPA chart resolvable by fervidex `chart_sha256: "asdfasdf"`. */
async function seedIidx511SpaWithFervidexHash() {
	await DB.insertInto("song")
		.values({
			id: Testing511Song.id,
			legacy_id: 511,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: "ANOTHER",
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: {
				...Testing511SPA.data,
				hashSHA256: "asdfasdf",
			},
		})
		.execute();
}

async function clearFerCardsAndSettings() {
	await DB.deleteFrom("priv_svc_fer_card").where("user_id", "=", 1).execute();
	await DB.deleteFrom("svc_fer_settings").where("user_id", "=", 1).execute();
}

afterAll(() => CloseServerConnection());

describe("POST /ir/fervidex/class/submit (Postgres)", () => {
	describe("headers (card + model + auth)", () => {
		beforeEach(async () => {
			await seedUserAndToken();
			await seedIidx511SpaWithFervidexHash();
		});

		it("rejects when card filters require X-Account-Id", async () => {
			await clearFerCardsAndSettings();
			await DB.insertInto("priv_svc_fer_card")
				.values({ user_id: 1, card_id: "foo" })
				.execute();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.set("X-Account-Id", "bar")
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(false);
		});

		it("rejects when card filters exist but no card header", async () => {
			await clearFerCardsAndSettings();
			await DB.insertInto("priv_svc_fer_card")
				.values({ user_id: 1, card_id: "foo" })
				.execute();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(false);
		});

		it.each([
			["2022082400", "CastHour"],
			["2021091500", "Bistrover"],
			["2020092900", "HEROIC VERSE"],
		] as const)("allows software model ext %s (%s)", async (ext, _label) => {
			await clearFerCardsAndSettings();
			const token = `mock_token_${Random20Hex()}`;
			await seedApiToken({ token, userId: 1, submitScore: true });

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("Authorization", `Bearer ${token}`)
				.set("User-Agent", FER_AGENT)
				.set("X-Software-Model", `LDJ:J:B:A:${ext}`)
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(true);
			await DB.deleteFrom("priv_api_token").where("token", "=", token).execute();
		});

		it("allows 30-omni", async () => {
			await clearFerCardsAndSettings();
			const token = `mock_token_${Random20Hex()}`;
			await seedApiToken({ token, userId: 1, submitScore: true });

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("Authorization", `Bearer ${token}`)
				.set("User-Agent", FER_AGENT)
				.set("X-Software-Model", "LDJ:J:B:X:2023090500")
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(true);
			await DB.deleteFrom("priv_api_token").where("token", "=", token).execute();
		});

		it.each([
			["LDJ:J:B:A:2019090200", "rootage v1"],
			["LDJ:J:B:A:2019100700", "rootage old"],
			["LDJ:J:B:A:2018091900", "cannonballers"],
		] as const)("accepts arcade model %s (%s)", async (model, _label) => {
			await clearFerCardsAndSettings();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders(model))
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(true);
		});

		it.each([
			["LDJ:J:B:A:NONSENSE", "nonsense"],
			["LDJ:J:B:Z:2020092900", "2dx-bms"],
		] as const)("rejects invalid X-Software-Model %s (%s)", async (model, _label) => {
			await clearFerCardsAndSettings();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders(model))
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(false);
		});

		it("rejects fervidex client older than 1.3.0", async () => {
			await clearFerCardsAndSettings();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("Authorization", "Bearer mock_token")
				.set("User-Agent", "fervidex/1.2.0")
				.set("X-Software-Model", ROOTAGE_MODEL)
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(false);
		});

		it.each([
			["fervidex/.0", "invalid agent"],
			["", "empty agent"],
			["invalid", "non-fervidex agent"],
		] as const)("rejects bad User-Agent: %s", async (ua, _label) => {
			await clearFerCardsAndSettings();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("Authorization", "Bearer mock_token")
				.set("User-Agent", ua)
				.set("X-Software-Model", ROOTAGE_MODEL)
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.body.success).toBe(false);
		});

		it("requires authorization", async () => {
			await clearFerCardsAndSettings();

			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("User-Agent", FER_AGENT)
				.set("X-Software-Model", ROOTAGE_MODEL)
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.status).toBe(401);

			const res2 = await mockApi
				.post("/ir/fervidex/class/submit")
				.set("Authorization", "Bearer invalid_token")
				.set("User-Agent", FER_AGENT)
				.set("X-Software-Model", ROOTAGE_MODEL)
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res2.status).toBe(401);
		});
	});

	describe("dan & body validation", () => {
		beforeEach(async () => {
			await seedUserAndToken();
			await clearFerCardsAndSettings();
		});

		it("updates SP dan to KAIDEN for course_id 18", async () => {
			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: true, course_id: 18, play_style: 0 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.description).toBe("Dan changed!");

			const gp = await DB.selectFrom("game_profile")
				.select("classes")
				.where("user_id", "=", 1)
				.where("game", "=", "iidx-sp")
				.executeTakeFirstOrThrow();

			const classes = typeof gp.classes === "string" ? JSON.parse(gp.classes) : gp.classes;
			expect(classes.dan).toBe("KAIDEN");

			const ach = await DB.selectFrom("class_achievement")
				.selectAll()
				.where("user_id", "=", 1)
				.where("game", "=", "iidx-sp")
				.orderBy("timestamp", "desc")
				.executeTakeFirstOrThrow();

			expect(ach).toMatchObject({
				user_id: 1,
				game: "iidx-sp",
				class_value: "KAIDEN",
				class_set: "dan",
			});
		});

		it("updates DP dan for course_id 17", async () => {
			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: true, course_id: 17, play_style: 1 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);

			const gp = await DB.selectFrom("game_profile")
				.select("classes")
				.where("user_id", "=", 1)
				.where("game", "=", "iidx-dp")
				.executeTakeFirstOrThrow();

			const classes = typeof gp.classes === "string" ? JSON.parse(gp.classes) : gp.classes;
			expect(classes.dan).toBe("CHUUDEN");
		});

		it("returns No Update Made when cleared is false", async () => {
			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: false, course_id: 17, play_style: 1 });

			expect(res.status).toBe(200);
			expect(res.body.description).toBe("No Update Made.");
		});

		it.each([
			[null, "[course_id] Expected an integer between 0 and 18. (Received null)"],
			[20, "[course_id] Expected an integer between 0 and 18. (Received 20)"],
			[-1, "[course_id] Expected an integer between 0 and 18. (Received -1)"],
		] as const)("rejects invalid course_id %s", async (course_id, errSubstring) => {
			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: true, course_id, play_style: 1 });

			expect(res.status).toBe(400);
			expect(String(res.body.error)).toContain(errSubstring);
		});

		it("rejects invalid play_style", async () => {
			const res = await mockApi
				.post("/ir/fervidex/class/submit")
				.set(ferHeaders())
				.send({ cleared: true, course_id: 16, play_style: null });

			expect(res.status).toBe(400);
			expect(String(res.body.error)).toContain("[play_style]");
		});
	});
});

describe("POST /ir/fervidex/score/submit (Postgres)", () => {
	beforeEach(async () => {
		await seedUserAndToken();
		await seedIidx511SpaWithFervidexHash();
		await clearFerCardsAndSettings();
	});

	it("requires authorization", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set("User-Agent", FER_AGENT)
			.set("X-Software-Model", ROOTAGE_MODEL)
			.send(FervidexBaseScore);

		expect(res.status).toBe(401);
	});

	it("imports a valid score", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set(ferHeaders())
			.send(FervidexBaseScore);

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);
		expect(res.body.body.userIntent).toBe(false);

		const row = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirst();

		expect(Number(row?.c)).toBe(1);
	});

	it("imports when option is undefined", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set(ferHeaders())
			.send(deepmerge(FervidexBaseScore, { option: undefined }));

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);

		const row = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirst();

		expect(Number(row?.c)).toBe(1);
	});

	it("imports 2dx-gsm score", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set(ferHeaders())
			.send(FervidexBaseGSMScore);

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);
	});

	it("rejects an invalid body", async () => {
		const res = await mockApi.post("/ir/fervidex/score/submit").set(ferHeaders()).send({});

		expect(res.body.success).toBe(false);
		expect(typeof res.body.error === "string" || typeof res.body.description === "string").toBe(
			true,
		);
	});

	it("records import errors for invalid ex_score after import finalises", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set(ferHeaders())
			.send(deepmerge(FervidexBaseScore, { ex_score: 9999 }));

		expect(res.status).toBe(200);
		const importId = res.body.body.importID as string;
		const doc = await LoadImportDocumentById(importId);

		expect(doc?.errors?.[0]?.type).toBe("InvalidDatapoint");
		expect(doc?.errors?.[0]?.message).toContain("EX Score cannot be greater than 1572");
	});

	it("records import error for invalid gauge", async () => {
		const res = await mockApi
			.post("/ir/fervidex/score/submit")
			.set(ferHeaders())
			.send(deepmerge(FervidexBaseScore, { gauge: [150] }));

		expect(res.status).toBe(200);
		const importId = res.body.body.importID as string;
		const doc = await LoadImportDocumentById(importId);

		expect(doc?.errors).toEqual([
			{
				type: "InvalidDatapoint",
				message: "Invalid value of gauge 150.",
			},
		]);
	});
});

describe.skip("POST /ir/fervidex/profile/submit - deferred KT bulk seed to Postgres", () => {
	it.skip("imports fervidex-static profile", () => {});
});
