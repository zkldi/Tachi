import { seedUser } from "#actions/test-utils/api-tokens";
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

import { EvaluateShowcaseStat } from "./evaluator";

async function seed511AndFolder() {
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
}

async function insertPb(userId: number, doc: typeof TestingIIDXSPScorePB) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
		...doc.scoreData,
		judgements: doc.scoreData.judgements,
	});

	await DB.insertInto("pb")
		.values({
			user_id: userId,
			chart_id: doc.chartID,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData),
			ranking_value: doc.scoreData.score,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: doc.highlight,
			time_achieved:
				doc.timeAchieved !== null && doc.timeAchieved !== undefined
					? UnixMillisecondsToISO8601(doc.timeAchieved)
					: null,
		})
		.execute();
}

describe("EvaluateShowcaseStat (ported from evaluator.oldtest.ts)", () => {
	beforeEach(async () => {
		await seedUser({ username: "eval_u", email: "eval@example.com" });
		await seed511AndFolder();
		await insertPb(1, TestingIIDXSPScorePB);
	});

	it("evaluates a folder stat", async () => {
		const data = await EvaluateShowcaseStat(
			"iidx-sp",
			{
				mode: "folder",
				slug: TestingIIDXFolderSP10.slug,
				metric: "lamp",
				gte: IIDX_LAMPS.HARD_CLEAR,
			},
			1,
		);

		expect(data).toEqual({
			value: 1,
			outOf: 1,
		});
	});

	it("evaluates a chart stat (PB + playcount)", async () => {
		const data = await EvaluateShowcaseStat(
			"iidx-sp",
			{
				chartID: Testing511SPA.chartID,
				mode: "chart",
			},
			1,
		);

		expect(data).toMatchObject({
			playcount: 0,
		});
		expect((data as { pb: unknown }).pb).not.toBeNull();
	});

	it("returns null PB when no score exists on chart", async () => {
		const data = await EvaluateShowcaseStat(
			"iidx-sp",
			{
				chartID: "nonsense",
				mode: "chart",
			},
			1,
		);

		expect(data).toMatchObject({
			pb: null,
			playcount: 0,
		});
	});
});
