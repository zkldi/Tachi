import { TachiConfig } from "#lib/setup/config";
import mockApi from "#test-utils/mock-api";
import { GetGameGroupConfig } from "tachi-common";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/games", () => {
	it("returns supported game groups and configs for each", async () => {
		const res = await mockApi.get("/api/v1/games");

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.supportedGames).toEqual(TachiConfig.GAME_GROUPS);

		expect({
			...res.body.body.configs.iidx,
			songData: null,
		}).toMatchObject({
			...GetGameGroupConfig("iidx"),
			songData: null,
		});

		expect(Object.keys(res.body.body.configs).length).toBe(TachiConfig.GAME_GROUPS.length);
	});
});
