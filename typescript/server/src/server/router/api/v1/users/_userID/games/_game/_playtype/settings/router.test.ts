import { seedApiToken } from "#actions/test-utils/api-tokens";
import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function seedIidxUgpt(userId: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
			...newGameProfilePreferenceColumns("iidx-sp"),
		})
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/settings", () => {
	beforeEach(async () => {
		const { id } = await seedUser({ username: `ugpt_get_${Date.now()}` });
		await seedIidxUgpt(id);
	});

	it("returns default IIDX SP settings", async () => {
		const res = await mockApi.get("/api/v1/users/1/games/iidx-sp/settings");

		expect(res.status).toBe(200);
		expect(res.body.body).toMatchObject({
			userID: 1,
			game: "iidx-sp",
			preferences: {
				preferredScoreAlg: null,
				preferredSessionAlg: null,
				preferredProfileAlg: null,
				preferredRanking: null,
				preferredDefaultEnum: null,
				defaultTable: null,
				stats: [],
				gameSpecific: {
					display2DXTra: false,
					bpiTarget: 0,
				},
			},
			rivals: [],
		});
	});
});

describe("PATCH /api/v1/users/:userID/games/:game/settings", () => {
	beforeEach(async () => {
		await seedUser({ username: "ugpt_patch", withCredential: true, withSettings: true });
		await seedIidxUgpt(1);
		await seedApiToken({ token: "api_token", userId: 1, identifier: "a" });
		await DB.updateTable("priv_api_token")
			.set({ pm_customise_profile: true })
			.where("priv_api_token.token", "=", "api_token")
			.execute();
	});

	it.each([
		"table-current-id",
		"levels",
	])("stores the canonical table ID when given %s", async (key) => {
		await DB.insertInto("table")
			.values({
				id: "table-current-id",
				slug: "levels",
				game: "iidx-sp",
				inactive: false,
				title: "Levels",
				default_value: false,
			})
			.execute();
		const res = await mockApi
			.patch("/api/v1/users/1/games/iidx-sp/settings")
			.set("Authorization", "Bearer api_token")
			.send({ defaultTable: key });
		expect(res.status).toBe(200);
		expect(res.body.body.preferences.defaultTable).toBe("table-current-id");
		const stored = await DB.selectFrom("game_profile")
			.select("pf_default_table")
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();
		expect(stored.pf_default_table).toBe("table-current-id");
	});

	it("rejects tables belonging to another game", async () => {
		await DB.insertInto("table")
			.values({
				id: "table-other-game",
				slug: "levels",
				game: "iidx-dp",
				inactive: false,
				title: "DP levels",
				default_value: false,
			})
			.execute();
		for (const key of ["levels", "table-other-game", "missing"]) {
			const res = await mockApi
				.patch("/api/v1/users/1/games/iidx-sp/settings")
				.set("Authorization", "Bearer api_token")
				.send({ defaultTable: key });
			expect(res.status).toBe(400);
		}
	});

	it("allows clearing the default table", async () => {
		await DB.updateTable("game_profile")
			.set({ pf_default_table: "previous" })
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.execute();
		const res = await mockApi
			.patch("/api/v1/users/1/games/iidx-sp/settings")
			.set("Authorization", "Bearer api_token")
			.send({ defaultTable: null });
		expect(res.status).toBe(200);
		expect(res.body.body.preferences.defaultTable).toBeNull();
	});

	it("updates preferredScoreAlg", async () => {
		const res = await mockApi
			.patch("/api/v1/users/1/games/iidx-sp/settings")
			.set("Authorization", "Bearer api_token")
			.send({
				preferredScoreAlg: "ktLampRating",
			});

		expect(res.status).toBe(200);
		expect(res.body.body.preferences.preferredScoreAlg).toBe("ktLampRating");
	});
});

describe("PATCH UG settings - extended cases", () => {
	it.todo(
		"port remaining router.oldtest.ts cases (BPI bounds, defaultTable validation, cross-user 403, …)",
	);
});
