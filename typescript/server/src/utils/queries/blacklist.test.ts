import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { GetBlacklist } from "./blacklist";

describe("GetBlacklist (Postgres)", () => {
	it("includes score_id rows from score_blacklist", async () => {
		const { id: userId } = await seedUser();
		const scoreId = `bl-score-${Date.now()}`;

		await DB.insertInto("score_blacklist")
			.values({
				user_id: userId,
				score_id: scoreId,
			})
			.execute();

		const list = await GetBlacklist();
		expect(list).toContain(scoreId);
	});
});
