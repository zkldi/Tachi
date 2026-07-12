import { seedUser } from "#actions/test-utils/api-tokens";
import { log } from "#lib/log/log";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import {
	Testing511Song,
	Testing511SPA,
	TestingIIDXSPScore,
	TestingIIDXSPScorePB,
} from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import crypto from "crypto";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import { UpdateUsersGamePlaytypeStats } from "./update-ugpt-stats";

async function seedIidx511ForPb() {
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
}

async function insertScoreFromTesting(opts: { userId: number }) {
	const { data, derived, judgements } = mongoScoreDataToPg(
		"iidx-sp",
		TestingIIDXSPScore.scoreData,
	);
	const t = UnixMillisecondsToISO8601(TestingIIDXSPScore.timeAchieved ?? Date.now());

	await DB.insertInto("score")
		.values({
			id: TestingIIDXSPScore.scoreID,
			user_id: opts.userId,
			chart_id: TestingIIDXSPScore.chartID,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(TestingIIDXSPScore.calculatedData ?? {}),
			meta: JSON.stringify(TestingIIDXSPScore.scoreMeta ?? {}),
			time_achieved: t,
			time_added: t,
			highlight: TestingIIDXSPScore.highlight,
			comment: null,
		})
		.execute();
}

async function insertPbFromTesting(opts: { pb: typeof TestingIIDXSPScorePB; userId: number }) {
	const { pb } = opts;
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", pb.scoreData);

	await DB.insertInto("pb")
		.values({
			user_id: opts.userId,
			chart_id: pb.chartID,
			lens: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(pb.calculatedData),
			ranking_value: pb.scoreData.score,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: pb.highlight,
			time_achieved: pb.timeAchieved ? UnixMillisecondsToISO8601(pb.timeAchieved) : null,
		})
		.execute();
}

describe("UpdateUsersGamePlaytypeStats (ported from update-ugpt-stats.oldtest.ts)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "ugpt_stats_u",
			email: "ugptstats@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedIidx511ForPb();
		await insertScoreFromTesting({ userId: 1 });
		await insertPbFromTesting({ userId: 1, pb: TestingIIDXSPScorePB });
	});

	it("creates game_profile with preference defaults when the user has none", async () => {
		const res = await UpdateUsersGamePlaytypeStats("iidx-sp", 1, null, log);

		expect(res).toEqual([]);

		const gp = await DB.selectFrom("game_profile")
			.selectAll()
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		const ratings = typeof gp.ratings === "string" ? JSON.parse(gp.ratings) : gp.ratings;
		expect(ratings).toMatchObject({
			ktLampRating: expect.any(Number),
			ktLampRatingHC: expect.any(Number),
			ktLampRatingEXHC: expect.any(Number),
		});

		const dataRaw = gp.data;
		expect(dataRaw).toBeDefined();
	});

	it("updates ratings when game_profile already exists", async () => {
		const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

		for (const e of ratings) {
			const fakeChart = crypto.randomBytes(20).toString("hex");
			await DB.insertInto("song")
				.values({
					id: `s_${fakeChart}`,
					legacy_id: 50_000 + e,
					game_group: "iidx",
					title: "T",
					artist: "A",
					search_terms: [],
					alt_titles: [],
					data: {},
					fts_document: "",
				})
				.execute();
			await DB.insertInto("chart")
				.values({
					id: fakeChart,
					legacy_id: fakeChart,
					game: "iidx-sp",
					song_id: `s_${fakeChart}`,
					difficulty: "ANOTHER",
					level: "10",
					level_num: 10,
					is_primary: true,
					versions: [],
					data: { inGameID: 1000, notecount: 786 },
				})
				.execute();

			await insertPbFromTesting({
				userId: 1,
				pb: deepmerge(TestingIIDXSPScorePB, {
					chartID: fakeChart,
					calculatedData: {
						BPI: 10.1,
						ktLampRating: e,
						ktLampRatingHC: e,
						ktLampRatingEXHC: e,
					},
				}),
			});
		}

		await UpdateUsersGamePlaytypeStats("iidx-sp", 1, null, log);

		const gp = await DB.selectFrom("game_profile")
			.select("ratings")
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		const r = typeof gp.ratings === "string" ? JSON.parse(gp.ratings) : gp.ratings;
		expect((r as { ktLampRating: number }).ktLampRating).toBe(
			ratings.reduce((a, e) => a + e, 0) / 20,
		);
	});

	it("returns class deltas from the class provider", async () => {
		await DB.insertInto("game_profile")
			.values({
				user_id: 1,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 0 }),
				classes: JSON.stringify({}),
			})
			.execute();

		const res = await UpdateUsersGamePlaytypeStats(
			"iidx-sp",
			1,
			() => ({ dan: "KAIDEN" }),
			log,
		);

		expect(res).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					game: "iidx-sp",
					set: "dan",
					old: null,
					new: "KAIDEN",
				}),
			]),
		);

		const gp = await DB.selectFrom("game_profile")
			.select("classes")
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();
		const cls = typeof gp.classes === "string" ? JSON.parse(gp.classes) : gp.classes;
		expect((cls as { dan: string }).dan).toBe("KAIDEN");
	});

	it("returns updated class deltas when a previous dan exists", async () => {
		await DB.insertInto("game_profile")
			.values({
				user_id: 1,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 0 }),
				classes: JSON.stringify({ dan: "CHUUDEN" }),
			})
			.execute();

		const res = await UpdateUsersGamePlaytypeStats(
			"iidx-sp",
			1,
			() => ({ dan: "KAIDEN" }),
			log,
		);

		expect(res).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					game: "iidx-sp",
					set: "dan",
					old: "CHUUDEN",
					new: "KAIDEN",
				}),
			]),
		);

		const gp = await DB.selectFrom("game_profile")
			.select("classes")
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();
		const cls = typeof gp.classes === "string" ? JSON.parse(gp.classes) : gp.classes;
		expect((cls as { dan: string }).dan).toBe("KAIDEN");
	});
});
