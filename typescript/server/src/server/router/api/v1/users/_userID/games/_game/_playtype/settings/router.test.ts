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
