import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { GetAdjacentAbove, GetAdjacentBelow } from "./pbs";

describe("GetAdjacentAbove / GetAdjacentBelow (Postgres)", () => {
	let n = 0;

	async function seedUscChartWithRankedPbs(rows: Array<{ ladderPos: number; userId: number }>) {
		const k = ++n;
		const songId = `song-pbs-${k}`;
		const chartId = `chart-pbs-${k}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 3_000_000 + k,
				game_group: "usc",
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
				game: "usc-controller",
				song_id: songId,
				level: "1",
				level_num: 1,
				is_primary: true,
				difficulty: "NOV",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		for (const r of rows) {
			await DB.insertInto("pb")
				.values({
					calculated_data: JSON.stringify({}),
					chart_id: chartId,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					judgements: JSON.stringify({}),
					lens: null,
					user_id: r.userId,
					ranking_value: 1000 - r.ladderPos,
					ranking_value_tb1: null,
					ranking_value_tb2: null,
					ranking_value_tb3: null,
					ranking_value_tb4: null,
					ranking_value_tb5: null,
					highlight: false,
					time_achieved: null,
				})
				.execute();
		}

		return { chartId };
	}

	const basePb = (chartId: string, rank: number) =>
		({
			chartID: chartId,
			rankingData: { outOf: 0, rank, rivalRank: null },
		}) as never;

	it("GetAdjacentAbove returns PBs with better rank (lower number)", async () => {
		const t = Date.now();
		const { id: u1 } = await seedUser({ username: `usc_a_${t}` });
		const { id: u2 } = await seedUser({ username: `usc_b_${t}` });
		const { id: u3 } = await seedUser({ username: `usc_c_${t}` });

		const { chartId } = await seedUscChartWithRankedPbs([
			{ ladderPos: 1, userId: u1 },
			{ ladderPos: 2, userId: u2 },
			{ ladderPos: 3, userId: u3 },
		]);

		const above = await GetAdjacentAbove(basePb(chartId, 3), 10);
		const ranks = above.map((p) => p.rankingData.rank).sort((a, b) => a - b);
		expect(ranks).toEqual([1, 2]);
	});

	it("GetAdjacentBelow returns PBs with worse rank (higher number)", async () => {
		const t = Date.now();
		const { id: u1 } = await seedUser({ username: `usc_d_${t}` });
		const { id: u2 } = await seedUser({ username: `usc_e_${t}` });
		const { id: u3 } = await seedUser({ username: `usc_f_${t}` });

		const { chartId } = await seedUscChartWithRankedPbs([
			{ ladderPos: 1, userId: u1 },
			{ ladderPos: 2, userId: u2 },
			{ ladderPos: 3, userId: u3 },
		]);

		const below = await GetAdjacentBelow(basePb(chartId, 2), 10);
		const ranks = below.map((p) => p.rankingData.rank).sort((a, b) => a - b);
		expect(ranks).toEqual([3]);
	});
});
