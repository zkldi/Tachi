import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { GetScoresFromSession, GetSessionFromScore } from "./session";

describe("GetScoresFromSession (Postgres)", () => {
	it("returns [] when session has no score IDs", async () => {
		const { id: userId } = await seedUser();
		const sessionId = `sess-empty-${Date.now()}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "E",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const scores = await GetScoresFromSession({
			userID: userId,
			sessionID: sessionId,
			scoreIDs: [],
			name: "E",
			desc: null,
			game: "iidx-sp",
			timeInserted: 0,
			timeStarted: 0,
			timeEnded: 0,
			calculatedData: {} as never,
			highlight: false,
		});

		expect(scores).toEqual([]);
	});

	it("loads score documents for session.scoreIDs", async () => {
		const { id: userId } = await seedUser();
		const sessionId = `sess-sc-${Date.now()}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "S",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		const songId = `song-sc-${sessionId}`;
		const chartId = `chart-sc-${sessionId}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_000_001,
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

		const scoreId = `sc-sess-${sessionId}`;

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

		const scores = await GetScoresFromSession({
			userID: userId,
			sessionID: sessionId,
			scoreIDs: [scoreId],
			name: "S",
			desc: null,
			game: "iidx-sp",
			timeInserted: 0,
			timeStarted: 0,
			timeEnded: 0,
			calculatedData: {} as never,
			highlight: false,
		});

		expect(scores).toHaveLength(1);
		expect(scores[0]?.scoreID).toBe(scoreId);
		expect(scores[0]?.chartID).toBe(chartId);
	});
});

describe("GetSessionFromScore (Postgres)", () => {
	it("returns null when score has no session_id", async () => {
		const { id: userId } = await seedUser();
		const songId = `song-ns-${Date.now()}`;
		const chartId = `chart-ns-${Date.now()}`;
		const scoreId = `score-ns-${Date.now()}`;
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_000_002,
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

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: null,
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

		const session = await GetSessionFromScore({
			service: "Unknown",
			game: "iidx-sp",
			userID: userId,
			scoreData: {} as never,
			calculatedData: {} as never,
			scoreID: scoreId,
			sessionID: null,
			scoreMeta: {} as never,
			timeAchieved: null,
			timeAdded: 0,
			highlight: false,
			comment: null,
			chartID: chartId,
			songID: "s9_000_002",
			isPrimary: true,
			importType: "file/batch-manual",
		});

		expect(session).toBeNull();
	});

	it("returns the session document when score.session_id is set", async () => {
		const { id: userId } = await seedUser();
		const sessionId = `sess-from-sc-${Date.now()}`;
		const songId = `song-fs-${sessionId}`;
		const chartId = `chart-fs-${sessionId}`;
		const scoreId = `score-fs-${sessionId}`;
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
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

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_000_003,
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

		const session = await GetSessionFromScore({
			service: "Unknown",
			game: "iidx-sp",
			userID: userId,
			scoreData: {} as never,
			calculatedData: {} as never,
			scoreID: scoreId,
			sessionID: sessionId,
			scoreMeta: {} as never,
			timeAchieved: null,
			timeAdded: 0,
			highlight: false,
			comment: null,
			chartID: chartId,
			songID: "s9000003",
			isPrimary: true,
			importType: "file/batch-manual",
		});

		expect(session).not.toBeNull();
		expect(session?.sessionID).toBe(sessionId);
		expect(session?.name).toBe("Named");
		expect(session?.scoreIDs).toContain(scoreId);
	});
});
