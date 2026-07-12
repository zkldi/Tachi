import type { UserDocument } from "tachi-common";

import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import { CreateScoreLogger } from "../common/import-logger";
import { CreateSessions } from "./sessions";

const scoreLogger = CreateScoreLogger(
	{ username: "test_zkldi", id: 1 } as UserDocument,
	"foo",
	"ir/direct-manual",
);

async function seed511() {
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

async function insertIidxScoreDoc(doc: typeof TestingIIDXSPScore) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
	const ta =
		doc.timeAchieved !== null && doc.timeAchieved !== undefined
			? UnixMillisecondsToISO8601(doc.timeAchieved)
			: null;
	const tAdded =
		typeof doc.timeAdded === "number"
			? UnixMillisecondsToISO8601(doc.timeAdded)
			: UnixMillisecondsToISO8601(Date.now());

	await DB.insertInto("score")
		.values({
			id: doc.scoreID,
			user_id: doc.userID,
			chart_id: doc.chartID,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData ?? {}),
			meta: JSON.stringify(doc.scoreMeta ?? {}),
			time_achieved: ta,
			time_added: tAdded,
			highlight: doc.highlight,
			comment: doc.comment,
		})
		.execute();
}

describe("CreateSessions (ported from sessions.oldtest.ts)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "sessions-fw@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seed511();
	});

	it("composes sessions from one timestamped score", async () => {
		await insertIidxScoreDoc(TestingIIDXSPScore);

		const res = await CreateSessions(
			1,
			{
				"iidx-sp": [TestingIIDXSPScore],
			},
			scoreLogger,
		);

		expect(res.length).toBe(1);
		expect(res[0]).toMatchObject({ type: "Created" });

		const count = await DB.selectFrom("session")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.executeTakeFirst();

		expect(Number(count?.c)).toBe(1);
	});

	it("does not compose sessions from untimestamped scores", async () => {
		const noTs = deepmerge(TestingIIDXSPScore, { timeAchieved: null });
		await insertIidxScoreDoc(noTs);

		const res = await CreateSessions(
			1,
			{
				"iidx-sp": [noTs],
			},
			scoreLogger,
		);

		expect(res).toEqual([]);

		const c = await DB.selectFrom("session")
			.select((eb) => eb.fn.countAll<number>().as("n"))
			.where("user_id", "=", 1)
			.executeTakeFirst();
		expect(Number(c?.n)).toBe(0);
	});
});
