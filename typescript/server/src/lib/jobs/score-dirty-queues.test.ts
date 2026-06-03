import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

function makeSongId(n: number): string {
	return `SDQ_S${n.toString(16).padStart(20, "0")}`;
}

function makeChartId(n: number): string {
	return `SDQ_C${n.toString(16).padStart(20, "0")}`;
}

function makeScoreId(n: number): string {
	return `SDQ_SC${n.toString(16).padStart(20, "0")}`;
}

async function insertSongAndChart(n: number) {
	const songId = makeSongId(n);
	const chartId = makeChartId(n);

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 9_300_000 + n,
			game_group: "iidx",
			title: `Dirty Queue Song ${n}`,
			artist: "X",
			search_terms: [],
			alt_titles: [],
			fts_document: "",
			data: JSON.stringify({}),
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `dirty_queue_${n}`,
			game: "iidx-sp",
			song_id: songId,
			level: "10",
			level_num: 10,
			is_primary: true,
			difficulty: "ANOTHER",
			versions: [],
			data: JSON.stringify({ notecount: 100 }),
		})
		.execute();

	return chartId;
}

function scoreRow(id: string, userId: number, chartId: string, sessionId: string | null) {
	return {
		id,
		user_id: userId,
		chart_id: chartId,
		game: "iidx-sp" as const,
		session_id: sessionId,
		import_id: null,
		data: JSON.stringify({}),
		derived_data: JSON.stringify({}),
		judgements: JSON.stringify({}),
		calculated_data: JSON.stringify({}),
		meta: JSON.stringify({}),
		time_achieved: new Date().toISOString(),
		time_added: new Date().toISOString(),
		highlight: false,
		comment: null,
	};
}

describe("score dirty queue triggers", () => {
	it("deduplicates dirty keys for batch score inserts", async () => {
		const { id: userId } = await seedUser({ username: "dirty_queue_batch_user" });
		const chartId = await insertSongAndChart(1);
		const sessionId = "dirty-queue-session-batch";

		await DB.insertInto("score")
			.values([
				scoreRow(makeScoreId(1), userId, chartId, sessionId),
				scoreRow(makeScoreId(2), userId, chartId, sessionId),
				scoreRow(makeScoreId(3), userId, chartId, sessionId),
			])
			.execute();

		const pbRows = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", chartId)
			.execute();
		const sessionRows = await DB.selectFrom("session_dirty")
			.selectAll()
			.where("session_dirty.session_id", "=", sessionId)
			.execute();
		const profileRows = await DB.selectFrom("game_profile_dirty")
			.selectAll()
			.where("game_profile_dirty.user_id", "=", userId)
			.where("game_profile_dirty.game", "=", "iidx-sp")
			.execute();

		expect(pbRows).toHaveLength(1);
		expect(sessionRows).toHaveLength(1);
		expect(profileRows).toHaveLength(1);
	});

	it("marks both old and new dirty keys when a score moves sessions", async () => {
		const { id: userId } = await seedUser({ username: "dirty_queue_update_user" });
		const chartId = await insertSongAndChart(2);
		const oldSessionId = "dirty-queue-session-old";
		const newSessionId = "dirty-queue-session-new";
		const scoreId = makeScoreId(4);

		await DB.insertInto("score")
			.values(scoreRow(scoreId, userId, chartId, oldSessionId))
			.execute();

		await DB.deleteFrom("session_dirty")
			.where("session_dirty.session_id", "in", [oldSessionId, newSessionId])
			.execute();

		await DB.updateTable("score")
			.set({ session_id: newSessionId })
			.where("score.id", "=", scoreId)
			.execute();

		const sessionRows = await DB.selectFrom("session_dirty")
			.select("session_dirty.session_id")
			.where("session_dirty.session_id", "in", [oldSessionId, newSessionId])
			.orderBy("session_dirty.session_id")
			.execute();

		expect(sessionRows.map((row) => row.session_id)).toEqual(
			[newSessionId, oldSessionId].sort(),
		);
	});
});
