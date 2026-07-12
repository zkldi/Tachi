import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { BMSGazerChart, BMSGazerSong, TestingLR2HookScore } from "#test-utils/test-data";
import { ApplyNTimes, RFA } from "#utils/misc";
import deepmerge from "deepmerge";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const GENOSIDE_OVERJOY_MD5SUMS =
	"cfad3baadce9e02c45021963453d7c9477d23be22b2370925c573d922276bce0188a99f74ab71804f2e360dcf484545cc46a81cb184f5a804c119930d6eba748";

afterAll(() => CloseServerConnection());

async function seedBmsGazer7k() {
	await DB.insertInto("song")
		.values({
			id: BMSGazerSong.id,
			legacy_id: 27_339,
			game_group: "bms",
			title: BMSGazerSong.title,
			artist: BMSGazerSong.artist,
			search_terms: BMSGazerSong.searchTerms,
			alt_titles: BMSGazerSong.altTitles,
			data: BMSGazerSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: BMSGazerChart.chartID,
			legacy_id: BMSGazerChart.chartID,
			game: "bms-7k",
			song_id: BMSGazerSong.id,
			difficulty: BMSGazerChart.difficulty,
			level: BMSGazerChart.level,
			level_num: BMSGazerChart.levelNum,
			is_primary: BMSGazerChart.isPrimary,
			versions: BMSGazerChart.versions,
			data: BMSGazerChart.data,
		})
		.execute();
}

describe("POST /ir/lr2hook/import (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "lr2hook-ir@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "foo",
			userId: 1,
			submitScore: true,
		});
		await seedBmsGazer7k();
	});

	it("imports when the token can submit scores", async () => {
		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer foo")
			.send(TestingLR2HookScore);

		expect(res.statusCode).toBe(200);
	});

	it("returns 403 when submit_score is false", async () => {
		await seedApiToken({
			token: "bar",
			userId: 1,
			submitScore: false,
		});

		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer bar")
			.send(TestingLR2HookScore);

		expect(res.statusCode).toBe(403);
	});

	it("returns 401 for unknown tokens", async () => {
		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer unknown token")
			.send(TestingLR2HookScore);

		expect(res.statusCode).toBe(401);
	});
});

describe("POST /ir/lr2hook/import/course (Postgres)", () => {
	const classBody = {
		md5: "cfad3baadce9e02c45021963453d7c9477d23be22b2370925c573d922276bce0188a99f74ab71804f2e360dcf484545cc46a81cb184f5a804c119930d6eba748",
		playerData: {
			autoScr: 0,
			gameMode: "shrug",
			gauge: "EASY",
			random: "MIRROR",
			rseed: undefined,
		},
		scoreData: {
			exScore: 10,
			bad: 10,
			good: 10,
			great: 10,
			hpGraph: ApplyNTimes(1000, () => RFA([100, 50, 80, 0])),
			lamp: "EASY",
			maxCombo: 10,
			moneyScore: 10,
			notesPlayed: 10,
			notesTotal: 10,
			pgreat: 10,
			poor: 10,
			extendedJudgements: undefined,
			extendedHpGraphs: undefined,
			unexpectedField: "foo",
		},
		unixTimestamp: undefined,
	};

	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "lr2hook-course@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "fake_api_token",
			userId: 1,
			submitScore: true,
		});

		await DB.insertInto("bms_course_lookup")
			.values({
				md5sums: GENOSIDE_OVERJOY_MD5SUMS,
				title: "GENOSIDE 2018 段位認定 Overjoy",
				set: "genocideDan",
				game: "bms-7k",
				value: "OVERJOY",
			})
			.execute();
	});

	it("updates class when the course clear matches", async () => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(classBody);

		expect(res.statusCode).toBe(200);
		expect(res.body.body.set).toBe("genocideDan");
		expect(res.body.body.value).toBe("OVERJOY");

		const gp = await DB.selectFrom("game_profile")
			.selectAll()
			.where("user_id", "=", 1)
			.where("game", "=", "bms-7k")
			.executeTakeFirst();

		const classes = typeof gp?.classes === "string" ? JSON.parse(gp.classes) : gp?.classes;
		expect(classes?.genocideDan).toBe("OVERJOY");
	});

	it("does not update class on failed clear", async () => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(deepmerge(classBody, { scoreData: { notesPlayed: 1 } }));

		expect(res.statusCode).toBe(200);
		expect(String(res.body.description)).toContain(
			"Class not updated. You failed to clear this course.",
		);

		const gp = await DB.selectFrom("game_profile")
			.selectAll()
			.where("user_id", "=", 1)
			.where("game", "=", "bms-7k")
			.executeTakeFirst();

		expect(gp).toBeUndefined();
	});

	it("returns 404 when course md5 is unknown", async () => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(deepmerge(classBody, { md5: "some nonsense" }));

		expect(res.statusCode).toBe(404);
	});
});
