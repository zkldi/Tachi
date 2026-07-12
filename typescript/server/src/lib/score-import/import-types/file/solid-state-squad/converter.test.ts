import { log } from "#lib/log/log";
import {
	InvalidScoreFailure,
	SkipScoreFailure,
} from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { MockParsedS3Score, Testing511Song, Testing511SPA } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import type { S3Score } from "./types";

import { ConvertFileS3, ParseDifficulty, ResolveS3Lamp } from "./converter";

const SONG_511_ID = Testing511Song.id;
const CHART_511_ID = Testing511SPA.chartID;

async function seed511SongOnly() {
	await DB.insertInto("song")
		.values({
			id: SONG_511_ID,
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
}

async function seed511ChartAnother() {
	await seed511SongOnly();

	await DB.insertInto("chart")
		.values({
			id: CHART_511_ID,
			legacy_id: CHART_511_ID,
			game: "iidx-sp",
			song_id: SONG_511_ID,
			difficulty: "ANOTHER",
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: ["7-cs"],
			data: Testing511SPA.data,
		})
		.execute();
}

async function seedAbsoluteHyper() {
	const songId = "s_absolute_ci";

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 97,
			game_group: "iidx",
			title: "ABSOLUTE",
			artist: "artist",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: "c_absolute_ci",
			legacy_id: "c_absolute_ci",
			game: "iidx-sp",
			song_id: songId,
			difficulty: "HYPER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["7-cs"],
			data: { inGameID: 1, notecount: 100 },
		})
		.execute();
}

function cfile(data: S3Score) {
	return ConvertFileS3(data, {}, "file/solid-state-squad", log);
}

function mfile(merge: Partial<S3Score>) {
	return cfile(deepmerge(MockParsedS3Score, merge));
}

describe("ConvertFileS3", () => {
	const dryScore = {
		game: "iidx-sp" as const,
		comment: null,
		importType: "file/solid-state-squad",
		service: "Solid State Squad",
		scoreData: {
			score: 100,
			lamp: "FULL COMBO",
			judgements: {
				pgreat: 25,
				great: 50,
				good: 0,
				bad: 0,
				poor: 4,
			},
			optional: {},
		},
		scoreMeta: {},
	};

	it("imports a valid S3 score", async () => {
		await seed511ChartAnother();

		const res = await cfile(MockParsedS3Score);

		expect(res.chart).toMatchObject({
			chartID: Testing511SPA.chartID,
			game: "iidx-sp",
			difficulty: "ANOTHER",
			level: Testing511SPA.level,
			song: Testing511Song,
		});
		expect(res.song).toMatchObject(Testing511Song);
		expect(res).toMatchObject({ dryScore });
		expect(res.dryScore.timeAchieved).toEqual(expect.any(Number));
	});

	it("supports comments on S3 scores", async () => {
		await seed511ChartAnother();

		const res = await mfile({ comment: "FOO BAR" });

		expect(res.chart).toMatchObject({
			chartID: Testing511SPA.chartID,
			game: "iidx-sp",
			difficulty: "ANOTHER",
		});
		expect(res.song).toMatchObject(Testing511Song);
		expect(res).toMatchObject({ dryScore: { ...dryScore, comment: "FOO BAR" } });
	});

	it("finds songs case-insensitively", async () => {
		await seed511ChartAnother();
		await seedAbsoluteHyper();

		const res = await mfile({ songname: "aBSolUte", diff: 7 });

		expect(res).toMatchObject({
			chart: { difficulty: "HYPER", game: "iidx-sp", song: { title: "ABSOLUTE" } },
			song: { title: "ABSOLUTE" },
		});
	});

	it("rejects invalid styles", async () => {
		await seed511SongOnly();

		await expect(mfile({ styles: "3rd,4th,INVALID" })).rejects.toMatchObject({
			failureType: "InvalidScore",
			message: expect.stringMatching(/Song has invalid style INVALID/u) as string,
		});
	});

	it("throws when no song matches", async () => {
		await expect(mfile({ songname: "INVALID SONG TITLE" })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: expect.stringMatching(
				/Could not find song with title INVALID SONG TITLE/u,
			) as string,
		});
	});

	it("throws when no chart matches difficulty", async () => {
		await seed511ChartAnother();

		await expect(mfile({ diff: "B" })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: expect.stringMatching(
				/Could not find chart 5\.1\.1\. \(iidx-sp LEGGENDARIA version \(7-cs\)\)/u,
			) as string,
		});
	});

	it("skips 5KEY scores", async () => {
		await seed511SongOnly();

		await expect(mfile({ diff: 5 })).rejects.toMatchObject({
			failureType: "SkipScore",
			message: expect.stringMatching(/5KEY scores are not supported/u) as string,
		});
	});

	it("rejects invalid difficulty", async () => {
		await seed511SongOnly();

		await expect(mfile({ diff: "INVALID" } as unknown as S3Score)).rejects.toMatchObject({
			failureType: "InvalidScore",
			message: expect.stringMatching(/Invalid difficulty INVALID/u) as string,
		});
	});

	it("rejects invalid hardeasy for a cleared lamp", async () => {
		await seed511ChartAnother();

		await expect(
			mfile({ mods: { hardeasy: "INVALID" }, cleartype: "cleared" } as unknown as S3Score),
		).rejects.toMatchObject({
			failureType: "InvalidScore",
			message: expect.stringMatching(
				/Invalid hardeasy of INVALID while evaluating a 'cleared' score\?/u,
			) as string,
		});
	});

	it("rejects invalid cleartype", async () => {
		await seed511ChartAnother();

		await expect(mfile({ cleartype: "INVALID" } as unknown as S3Score)).rejects.toMatchObject({
			failureType: "InvalidScore",
			message: expect.stringMatching(/Invalid cleartype of INVALID/u) as string,
		});
	});

	it("rejects invalid timestamps", async () => {
		await seed511ChartAnother();

		await expect(mfile({ date: "INVALID" })).rejects.toMatchObject({
			failureType: "InvalidScore",
			message: expect.stringMatching(
				/Invalid\/Unparsable score timestamp of INVALID/u,
			) as string,
		});
	});
});

describe("ParseDifficulty", () => {
	it("maps S3 difficulty tokens to IIDX SP/DP charts", () => {
		expect(ParseDifficulty("L7")).toStrictEqual({ game: "iidx-sp", difficulty: "NORMAL" });
		expect(ParseDifficulty(7)).toStrictEqual({ game: "iidx-sp", difficulty: "HYPER" });
		expect(ParseDifficulty("A")).toStrictEqual({ game: "iidx-sp", difficulty: "ANOTHER" });
		expect(ParseDifficulty("B")).toStrictEqual({ game: "iidx-sp", difficulty: "LEGGENDARIA" });
		expect(ParseDifficulty("L14")).toStrictEqual({ game: "iidx-dp", difficulty: "NORMAL" });
		expect(ParseDifficulty(14)).toStrictEqual({ game: "iidx-dp", difficulty: "HYPER" });
		expect(ParseDifficulty("A14")).toStrictEqual({ game: "iidx-dp", difficulty: "ANOTHER" });
		expect(ParseDifficulty("B14")).toStrictEqual({
			game: "iidx-dp",
			difficulty: "LEGGENDARIA",
		});
		expect(() => ParseDifficulty(5)).toThrow(SkipScoreFailure);
	});
});

describe("ResolveS3Lamp", () => {
	it("maps cleartype and hardeasy to lamps", () => {
		expect(ResolveS3Lamp({ cleartype: "played" } as S3Score)).toBe("FAILED");
		expect(ResolveS3Lamp({ cleartype: "cleared", mods: {} } as S3Score)).toBe("CLEAR");
		expect(ResolveS3Lamp({ cleartype: "cleared", mods: { hardeasy: "E" } } as S3Score)).toBe(
			"EASY CLEAR",
		);
		expect(ResolveS3Lamp({ cleartype: "cleared", mods: { hardeasy: "H" } } as S3Score)).toBe(
			"HARD CLEAR",
		);
		expect(ResolveS3Lamp({ cleartype: "combo" } as S3Score)).toBe("FULL COMBO");
		expect(ResolveS3Lamp({ cleartype: "comboed" } as S3Score)).toBe("FULL COMBO");
		expect(ResolveS3Lamp({ cleartype: "perfect" } as S3Score)).toBe("FULL COMBO");
		expect(ResolveS3Lamp({ cleartype: "perfected" } as S3Score)).toBe("FULL COMBO");
	});

	it("rejects unknown cleartype or hardeasy", () => {
		expect(() => ResolveS3Lamp({ cleartype: "invalid" } as unknown as S3Score)).toThrow(
			InvalidScoreFailure,
		);
		expect(() =>
			ResolveS3Lamp({
				cleartype: "cleared",
				mods: { hardeasy: "invalid" },
			} as unknown as S3Score),
		).toThrow(InvalidScoreFailure);
	});
});
