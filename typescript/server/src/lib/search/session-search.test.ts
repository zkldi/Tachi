import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { SearchSessionsForUserGptFtsAndTrgm } from "./session-search";

describe("SearchSessionsForUserGptFtsAndTrgm", () => {
	it("returns [] for empty or whitespace query", async () => {
		const { id: userId } = await seedUser();
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: `sess-empty-q-${Date.now()}`,
				user_id: userId,
				game: "iidx-sp",
				name: "Named",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		expect(await SearchSessionsForUserGptFtsAndTrgm(userId, "iidx-sp", "", 10)).toEqual([]);
		expect(await SearchSessionsForUserGptFtsAndTrgm(userId, "iidx-sp", "  ", 10)).toEqual([]);
	});

	it("matches session name via FTS and scopes by user + game", async () => {
		const n = Date.now();
		const { id: userId } = await seedUser({ username: `sess_fts_u_${n}` });
		const { id: otherUserId } = await seedUser({ username: `sess_fts_other_${n}` });
		const now = new Date().toISOString();
		const token = `SessFtsTok${Date.now()}`;

		await DB.insertInto("session")
			.values({
				id: `sess-fts-a-${Date.now()}`,
				user_id: userId,
				game: "iidx-sp",
				name: `${token} Alpha`,
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		await DB.insertInto("session")
			.values({
				id: `sess-fts-other-${Date.now()}`,
				user_id: otherUserId,
				game: "iidx-sp",
				name: `${token} OtherUser`,
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const hits = await SearchSessionsForUserGptFtsAndTrgm(userId, "iidx-sp", token, 10);

		expect(hits).toHaveLength(1);
		expect(hits[0]!.session.sessionID.startsWith("sess-fts-a-")).toBe(true);
		expect(hits[0]!.rank).toBeGreaterThan(0);
	});

	it("matches description text", async () => {
		const { id: userId } = await seedUser();
		const now = new Date().toISOString();
		const sid = `sess-desc-${Date.now()}`;

		await DB.insertInto("session")
			.values({
				id: sid,
				user_id: userId,
				game: "iidx-sp",
				name: "X",
				description: "only_in_description_token_xyzzy",
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const hits = await SearchSessionsForUserGptFtsAndTrgm(
			userId,
			"iidx-sp",
			"only_in_description_token_xyzzy",
			10,
		);

		expect(hits.some((h) => h.session.sessionID === sid)).toBe(true);
	});
});
