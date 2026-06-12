import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { GetClassDistribution } from "./stats";

describe("GetClassDistribution (Postgres)", () => {
	it("groups game_profile.classes by key for the game", async () => {
		const t = Date.now();
		const { id: u1 } = await seedUser({ username: `stats_a_${t}` });
		const { id: u2 } = await seedUser({ username: `stats_b_${t}` });

		await DB.insertInto("game_profile")
			.values({
				user_id: u1,
				game: "iidx-sp",
				ratings: JSON.stringify({}),
				classes: JSON.stringify({ dan: "10th" }),
			})
			.execute();

		await DB.insertInto("game_profile")
			.values({
				user_id: u2,
				game: "iidx-sp",
				ratings: JSON.stringify({}),
				classes: JSON.stringify({ dan: "10th" }),
			})
			.execute();

		const dist = await GetClassDistribution("iidx", "SP", "dan");
		expect(dist["10th"]).toBe(2);
	});
});
