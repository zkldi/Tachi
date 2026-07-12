import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { IIDX_LAMPS, type ScoreData } from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const chart = Testing511SPA;

async function seedIidx511Chart() {
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
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertIidxScore(opts: {
	scoreId: string;
	sd: ScoreData<"iidx-sp">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("IIDX_IMPL CreatePBDoc integration", () => {
	beforeEach(seedIidx511Chart);

	for (const game of ["iidx-sp", "iidx-dp"] as const) {
		describe(`CreatePBDoc (${game})`, () => {
			it("joins best lamp", async () => {
				const { id: userId } = await seedUser({ username: `iidx_pb_lamp_${game}` });
				const main = mkFakeScoreIIDXSP({ userID: userId });

				const lampSd: ScoreData<"iidx-sp"> = {
					...main.scoreData,
					score: 0,
					lamp: "FULL COMBO",
					enumIndexes: {
						...main.scoreData.enumIndexes,
						lamp: IIDX_LAMPS.FULL_COMBO,
					},
				};

				await insertIidxScore({
					userId,
					scoreId: main.scoreID,
					sd: main.scoreData,
					timeMs: 1000,
				});
				await insertIidxScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

				const pb = await CreatePBDoc(game, userId, chart, log);

				expect(pb).toMatchObject({
					composedFrom: [
						{ name: "Best Score" },
						{ name: "Best Lamp", scoreID: "bestLamp" },
					],
					scoreData: {
						score: 786,
						lamp: "FULL COMBO",
						enumIndexes: {
							lamp: IIDX_LAMPS.FULL_COMBO,
						},
					},
				});
			});

			it("joins lowest BP", async () => {
				const { id: userId } = await seedUser({ username: `iidx_pb_bp_${game}` });

				const a = mkFakeScoreIIDXSP({
					userID: userId,
					scoreID: "whateverBP",
					scoreData: { optional: { bp: 100 } },
				});
				const b = mkFakeScoreIIDXSP({
					userID: userId,
					scoreID: "lowestBP",
					scoreData: { optional: { bp: 1 } },
				});
				const c = mkFakeScoreIIDXSP({
					userID: userId,
					scoreID: "nullBP",
					scoreData: { optional: { bp: null } },
				});

				await insertIidxScore({
					userId,
					scoreId: a.scoreID,
					sd: a.scoreData,
					timeMs: 1000,
				});
				await insertIidxScore({
					userId,
					scoreId: b.scoreID,
					sd: b.scoreData,
					timeMs: 2000,
				});
				await insertIidxScore({
					userId,
					scoreId: c.scoreID,
					sd: c.scoreData,
					timeMs: 3000,
				});

				const pb = await CreatePBDoc(game, userId, chart, log);

				expect(pb).toMatchObject({
					composedFrom: [
						{ name: "Best Score" },
						{ name: "Lowest BP", scoreID: "lowestBP" },
					],
					scoreData: {
						score: 786,
						optional: { bp: 1 },
					},
				});
			});
		});
	}
});
