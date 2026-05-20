import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { describe, expect, it } from "vitest";

import { GetRecentUGPTHighlights, GetRecentUGPTScores } from "./scores";

describe("GetRecentUGPTScores / GetRecentUGPTHighlights (Postgres)", () => {
	let counter = 0;

	async function seedIidxScore(opts: {
		highlight: boolean;
		scoreId: string;
		timeAchievedMs: number | null;
		userId: number;
	}) {
		const n = ++counter;
		const songId = `song-qscores-${n}`;
		const chartId = `chart-qscores-${n}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 6_000_000 + n,
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
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("score")
			.values({
				id: opts.scoreId,
				user_id: opts.userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				judgements: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved:
					opts.timeAchievedMs !== null
						? UnixMillisecondsToISO8601(opts.timeAchievedMs)
						: null,
				time_added: new Date().toISOString(),
				highlight: opts.highlight,
				comment: null,
			})
			.execute();
	}

	it("GetRecentUGPTScores orders by time_achieved desc, nulls last", async () => {
		const { id: userId } = await seedUser();
		await seedIidxScore({
			userId,
			scoreId: `sc-old-${Date.now()}`,
			highlight: false,
			timeAchievedMs: 1_000_000,
		});
		await seedIidxScore({
			userId,
			scoreId: `sc-new-${Date.now()}`,
			highlight: false,
			timeAchievedMs: 9_000_000,
		});
		await seedIidxScore({
			userId,
			scoreId: `sc-null-${Date.now()}`,
			highlight: false,
			timeAchievedMs: null,
		});

		const scores = await GetRecentUGPTScores(userId, "iidx-sp", 10);
		expect(scores.length).toBeGreaterThanOrEqual(3);
		// newest play time first
		expect(scores[0]?.timeAchieved).toBeGreaterThanOrEqual(scores[1]?.timeAchieved ?? 0);
		// null time_achieved sorts last
		expect(scores[scores.length - 1]?.timeAchieved).toBeNull();
	});

	it("GetRecentUGPTHighlights only returns highlight scores", async () => {
		const { id: userId } = await seedUser();
		const base = Date.now();
		await seedIidxScore({
			userId,
			scoreId: `sc-hl-no-${base}`,
			highlight: false,
			timeAchievedMs: base + 1000,
		});
		await seedIidxScore({
			userId,
			scoreId: `sc-hl-yes-${base}`,
			highlight: true,
			timeAchievedMs: base + 2000,
		});

		const highlights = await GetRecentUGPTHighlights(userId, "iidx-sp", 50);
		const ours = highlights.filter((s) => s.scoreID.startsWith("sc-hl-"));
		expect(ours).toHaveLength(1);
		expect(ours[0]?.highlight).toBe(true);
	});
});
