import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { LoadSessionDocumentById } from "./session";

describe("LoadSessionDocumentById", () => {
	it("returns undefined when session is missing", async () => {
		expect(await LoadSessionDocumentById("no-such-session")).toBeUndefined();
	});

	it("maps session row and score IDs", async () => {
		const { id: userId } = await seedUser();
		const sessionId = `sess-full-${Date.now()}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "N",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const songId = `s-${sessionId}`;
		const chartId = `c-${sessionId}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 1,
				game_group: "iidx",
				title: "T",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "iidx-sp",
				song_id: songId,
				level: "1",
				level_num: 1,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		const scoreId = `sc-${sessionId}`;

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: sessionId,
				import_id: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				judgements: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: null,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();

		const doc = await LoadSessionDocumentById(sessionId);

		expect(doc).toMatchObject({
			sessionID: sessionId,
			userID: userId,
			name: "N",
			scoreIDs: [scoreId],
			game: "iidx-sp",
		});
	});
});
