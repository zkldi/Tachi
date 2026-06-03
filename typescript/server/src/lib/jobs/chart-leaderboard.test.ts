import { ReconcileChartLeaderboardJob } from "#lib/jobs/reconcile-chart-leaderboard";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

function makeSongId(n: number): string {
	return `SL${n.toString(16).padStart(20, "0")}`;
}

function makeChartId(n: number): string {
	return `CL${n.toString(16).padStart(20, "0")}`;
}

function makeLegacyId(n: number): string {
	return `leaderboard_${n.toString(16).padStart(28, "0")}`;
}

async function insertSongAndChart(songId: string, chartId: string) {
	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 9_020_000,
			game_group: "iidx",
			title: "Leaderboard Reconcile Song",
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
			legacy_id: makeLegacyId(1),
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
}

describe("chart_leaderboard reconciliation", () => {
	it("rebuilds missing leaderboard rows for existing PBs", async () => {
		const songId = makeSongId(1);
		const chartId = makeChartId(1);

		await insertSongAndChart(songId, chartId);

		const { id: userId } = await seedUser({ username: "leaderboard_reconcile_user" });

		const pbRow = await DB.insertInto("pb")
			.values({
				user_id: userId,
				chart_id: chartId,
				lens: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
				judgements: JSON.stringify({}),
				ranking_value: 123,
				ranking_value_tb1: null,
				ranking_value_tb2: null,
				ranking_value_tb3: null,
				ranking_value_tb4: null,
				ranking_value_tb5: null,
				highlight: false,
				time_achieved: new Date().toISOString(),
			})
			.returning("row_id")
			.executeTakeFirstOrThrow();

		let leaderboardRows = await DB.selectFrom("chart_leaderboard")
			.select(["chart_leaderboard.row_id"])
			.where("chart_leaderboard.row_id", "=", pbRow.row_id)
			.execute();

		expect(leaderboardRows).toHaveLength(1);

		await DB.deleteFrom("chart_leaderboard")
			.where("chart_leaderboard.row_id", "=", pbRow.row_id)
			.execute();

		leaderboardRows = await DB.selectFrom("chart_leaderboard")
			.select(["chart_leaderboard.row_id"])
			.where("chart_leaderboard.row_id", "=", pbRow.row_id)
			.execute();

		expect(leaderboardRows).toHaveLength(0);

		const refreshed = await ReconcileChartLeaderboardJob();

		expect(refreshed).toBe(1);

		const rebuiltRows = await DB.selectFrom("chart_leaderboard")
			.select(["chart_leaderboard.rank", "chart_leaderboard.out_of"])
			.where("chart_leaderboard.row_id", "=", pbRow.row_id)
			.execute();

		expect(rebuiltRows).toEqual([{ out_of: 1, rank: 1 }]);
	});
});
