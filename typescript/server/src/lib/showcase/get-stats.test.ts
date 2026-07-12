import { seedUser } from "#actions/test-utils/api-tokens";
import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import {
	Testing511Song,
	Testing511SPA,
	TestingIIDXFolderSP10,
	TestingIIDXSPScorePB,
} from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { IIDX_LAMPS } from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

import { EvaluateUsersStatsShowcase } from "./get-stats";

async function seedFixtures() {
	await seedUser({ username: "showcase_u", email: "showcase@example.com" });

	await DB.insertInto("song")
		.values({
			id: Testing511Song.id,
			legacy_id: 1,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: Testing511SPA.difficulty,
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();

	await DB.insertInto("folder")
		.values({
			id: TestingIIDXFolderSP10.folderID,
			legacy_id: TestingIIDXFolderSP10.folderID,
			game: "iidx-sp",
			inactive: false,
			title: TestingIIDXFolderSP10.title,
			slug: TestingIIDXFolderSP10.slug,
			where: "chart.level_num = 10",
			version_filter: null,
			search_terms: [],
		})
		.execute();

	await DB.insertInto("folder_chart_lookup")
		.values({ folder_id: TestingIIDXFolderSP10.folderID, chart_id: Testing511SPA.chartID })
		.execute();

	const stats = [
		{
			mode: "folder" as const,
			slug: TestingIIDXFolderSP10.slug,
			metric: "lamp",
			gte: IIDX_LAMPS.HARD_CLEAR,
		},
		{
			mode: "chart" as const,
			chartID: Testing511SPA.chartID,
		},
	];

	await DB.insertInto("game_profile")
		.values({
			user_id: 1,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
			...newGameProfilePreferenceColumns("iidx-sp"),
			showcase: JSON.stringify(stats),
		})
		.execute();

	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
		...TestingIIDXSPScorePB.scoreData,
		judgements: TestingIIDXSPScorePB.scoreData.judgements,
	});

	await DB.insertInto("pb")
		.values({
			user_id: 1,
			chart_id: TestingIIDXSPScorePB.chartID,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(TestingIIDXSPScorePB.calculatedData),
			ranking_value: TestingIIDXSPScorePB.scoreData.score,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: TestingIIDXSPScorePB.highlight,
			time_achieved:
				TestingIIDXSPScorePB.timeAchieved !== null &&
				TestingIIDXSPScorePB.timeAchieved !== undefined
					? UnixMillisecondsToISO8601(TestingIIDXSPScorePB.timeAchieved)
					: null,
		})
		.execute();
}

describe("EvaluateUsersStatsShowcase (ported from get-stats.oldtest.ts)", () => {
	beforeEach(seedFixtures);

	it("evaluates configured stats for the user", async () => {
		const res = await EvaluateUsersStatsShowcase(1, "iidx-sp");

		expect(res).toHaveLength(2);
		expect(res[0]).toMatchObject({
			stat: { mode: "folder", slug: TestingIIDXFolderSP10.slug },
			result: { value: 1, outOf: 1 },
		});
		expect(res[1]?.stat).toMatchObject({ mode: "chart", chartID: Testing511SPA.chartID });
	});

	it("throws when the user has no game_profile row", async () => {
		await DB.deleteFrom("game_profile").where("game_profile.user_id", "=", 1).execute();

		await expect(EvaluateUsersStatsShowcase(1, "iidx-sp")).rejects.toThrow();
	});
});
