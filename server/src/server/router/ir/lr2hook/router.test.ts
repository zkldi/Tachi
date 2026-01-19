import deepmerge from "deepmerge";
import db from "external/mongo/db";
import t from "tap";
import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import { TestingLR2HookScore } from "test-utils/test-data";
import { ApplyNTimes, RFA } from "utils/misc";

t.test("POST /ir/lr2hook/import", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(async () => {
		await db["api-tokens"].insert({
			token: "foo",
			permissions: { submit_score: true },
			fromAPIClient: null,
			identifier: "foo",
			userID: 1,
		});
	});

	t.test("Should import a score if the API token has the right permissions.", async (t) => {
		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer foo")
			.send(TestingLR2HookScore);

		t.equal(res.statusCode, 200);

		t.end();
	});

	t.test("Should import a score if the API token has the right permissions.", async (t) => {
		await db["api-tokens"].insert({
			token: "bar",
			permissions: { submit_score: false },
			fromAPIClient: null,
			identifier: "bar",
			userID: 1,
		});

		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer bar")
			.send(TestingLR2HookScore);

		t.equal(res.statusCode, 403);

		t.end();
	});

	t.test("Should import a score if the API token has the right permissions.", async (t) => {
		const res = await mockApi
			.post("/ir/lr2hook/import")
			.set("Authorization", "Bearer unknown token")
			.send(TestingLR2HookScore);

		t.equal(res.statusCode, 401);

		t.end();
	});

	t.end();
});

t.test("POST /ir/lr2hook/import/course", (t) => {
	t.beforeEach(ResetDBState);

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

	t.test("Should update a user's class if necessary.", async (t) => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(classBody);

		t.equal(res.statusCode, 200);
		t.equal(res.body.body.set, "genocideDan");
		t.equal(res.body.body.value, "OVERJOY");

		const dbRes = await db["game-stats"].findOne({
			userID: 1,
			game: "bms",
			playtype: "7K",
		});

		t.equal(dbRes?.classes.genocideDan, "OVERJOY");

		t.end();
	});

	t.test("Should not update a user's class if they didn't clear the course.", async (t) => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(deepmerge(classBody, { scoreData: { notesPlayed: 1 } }));

		t.equal(res.statusCode, 200);
		t.match(res.body.description, "Class not updated. You failed to clear this course.");

		const dbRes = await db["game-stats"].findOne({
			userID: 1,
			game: "bms",
			playtype: "7K",
		});

		t.not(dbRes?.classes.genocideDan, 22);

		t.end();
	});

	t.test("Should 404 if the course doesn't exist.", async (t) => {
		const res = await mockApi
			.post("/ir/lr2hook/import/course")
			.set("Authorization", "Bearer fake_api_token")
			.send(deepmerge(classBody, { md5: "some nonsense" }));

		t.equal(res.statusCode, 404);

		t.end();
	});

	t.end();
});
