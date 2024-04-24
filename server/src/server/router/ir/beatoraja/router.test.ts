import deepmerge from "deepmerge";
import db from "external/mongo/db";
import t from "tap";
import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import { MockBeatorajaBMSScore, MockBeatorajaPMSScore } from "test-utils/test-data";
import type { UserDocument } from "tachi-common";

const NEW_SHA256 = "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732";
const NEW_MD5 = "d0f497c0f955e7edfb0278f446cdb6f8";

t.test("POST /ir/beatoraja/submit-score", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(() =>
		db["api-tokens"].insert({
			userID: 1,
			identifier: "Mock API Beatoraja Token",
			permissions: {
				submit_score: true,
			},
			token: "mock_token",
			fromAPIClient: null,
		})
	);

	t.test("Should import a valid BMS score.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(MockBeatorajaBMSScore);

		t.equal(res.status, 200);

		t.equal(res.body.success, true);
		t.hasStrict(res.body.body, {
			score: {
				game: "bms",
				scoreData: {
					score: 1004,
				},
				importType: "ir/beatoraja",
			},
			chart: {
				chartID: "88eb6cc5683e2740cbd07f588a5f3db1db8d467b",
			},
			song: {
				id: 27339,
			},
		});

		const score = await db.scores.findOne(
			{ scoreID: res.body.body.score.scoreID },
			{ projection: { _id: 0 } }
		);

		t.not(score, null);

		t.hasStrict(res.body.body.score, score);
		t.hasStrict(res.body.body.score, score);

		t.end();
	});

	t.test("Should import a valid PMS score.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(MockBeatorajaPMSScore);

		t.equal(res.status, 200);

		t.equal(res.body.success, true);
		t.hasStrict(res.body.body, {
			score: {
				game: "pms",
				playtype: "Controller",
				scoreData: {
					score: 1004,
				},
				importType: "ir/beatoraja",
			},
			chart: {
				chartID: "0446f1b54e90d631ff9fe98419ebaea9481fab1f",
			},
			song: {
				id: 1,
			},
		});

		const score = await db.scores.findOne(
			{ scoreID: res.body.body.score.scoreID },
			{ projection: { _id: 0 } }
		);

		t.not(score, null);

		t.hasStrict(res.body.body.score, score);

		t.end();
	});

	t.test("Should infer playtype from the PMS score.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaPMSScore, { score: { deviceType: "KEYBOARD" } }));

		t.equal(res.status, 200);

		t.equal(res.body.success, true);
		t.hasStrict(res.body.body, {
			score: {
				game: "pms",
				playtype: "Keyboard",
				scoreData: {
					score: 1004,
				},
				importType: "ir/beatoraja",
			},
			chart: {
				chartID: "ca553d77cbf8b3e9e7709dad6123ffed1695a1dd",
			},
			song: {
				id: 1,
			},
		});

		const score = await db.scores.findOne(
			{ scoreID: res.body.body.score.scoreID },
			{ projection: { _id: 0 } }
		);

		t.not(score, null);

		t.hasStrict(res.body.body.score, score);

		t.end();
	});

	t.test("Should return an error if invalid client.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaBMSScore, { client: "INVALID" }));

		t.equal(res.status, 400);

		t.equal(res.body.success, false);
		t.match(res.body.description, /Unsupported client/u);

		t.end();
	});

	t.test("Should return an error if BMS scores try to use beatoraja.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaBMSScore, { client: "beatoraja 0.8.0" }));

		t.equal(res.status, 400);

		t.equal(res.body.success, false);
		t.match(res.body.description, /Unsupported client/u);

		t.end();
	});

	t.test("Should return an error if PMS scores try to use lr2oraja.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaPMSScore, { client: "LR2oraja 0.8.0" }));

		t.equal(res.status, 400);

		t.equal(res.body.success, false);
		t.match(res.body.description, /Unsupported client/u);

		t.end();
	});

	t.test("Should return an error if invalid score.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaBMSScore, { score: { exscore: -1 } }));

		t.equal(res.status, 400);

		t.equal(res.body.success, false);
		t.match(res.body.description, /Invalid Beatoraja Import - Score/u);

		t.end();
	});

	t.test("Should return an error if invalid chart.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(MockBeatorajaBMSScore, { chart: { title: null } }));

		t.equal(res.status, 400);

		t.equal(res.body.success, false);
		t.match(res.body.description, /Invalid Beatoraja Import - Chart/u);

		t.end();
	});

	t.test("Should defer a chart to the orphan queue if not found.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(MockBeatorajaBMSScore, {
					chart: { sha256: NEW_SHA256, md5: NEW_MD5 },
					score: { sha256: NEW_SHA256, md5: NEW_MD5 },
				})
			);

		t.equal(res.status, 202);

		t.equal(res.body.success, true);
		t.match(res.body.description, /Chart and score have been orphaned/u);

		const orphanChart = await db["orphan-chart-queue"].findOne({
			"chartDoc.data.hashSHA256": NEW_SHA256,
		});

		t.hasStrict(orphanChart?.chartDoc, {
			data: {
				hashSHA256: NEW_SHA256,
				hashMD5: NEW_MD5,
			},
		});

		t.end();
	});

	t.test("Should eventually unorphan a chart.", async (t) => {
		await db["api-tokens"].insert([
			{
				userID: 2,
				identifier: "token2",
				permissions: { submit_score: true },
				token: "token2",
				fromAPIClient: null,
			},
			{
				userID: 3,
				identifier: "token3",
				permissions: { submit_score: true },
				token: "token3",
				fromAPIClient: null,
			},
		]);

		await db.users.insert([
			{
				id: 2,
				username: "foo",
				usernameLowercase: "foo",
			},
			{
				id: 3,
				username: "bar",
				usernameLowercase: "bar",
			},
		] as Array<UserDocument>);

		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(MockBeatorajaBMSScore, {
					chart: { sha256: NEW_SHA256, md5: NEW_MD5 },
					score: { sha256: NEW_SHA256, md5: NEW_MD5 },
				})
			);

		t.equal(res.statusCode, 202);

		const res2 = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer token2")
			.send(
				deepmerge(MockBeatorajaBMSScore, {
					chart: { sha256: NEW_SHA256, md5: NEW_MD5 },
					score: { sha256: NEW_SHA256, md5: NEW_MD5 },
				})
			);

		t.equal(res2.statusCode, 202);

		const orphanData = await db["orphan-chart-queue"].findOne({
			"chartDoc.data.hashSHA256": NEW_SHA256,
		});

		t.strictSame(orphanData?.userIDs, [1, 2]);

		const res3 = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer token3")
			.send(
				deepmerge(MockBeatorajaBMSScore, {
					chart: { sha256: NEW_SHA256, md5: NEW_MD5 },
					score: { sha256: NEW_SHA256, md5: NEW_MD5 },
				})
			);

		t.equal(res3.statusCode, 200);

		const orphanData2 = await db["orphan-chart-queue"].findOne({
			"chartDoc.data.hashSHA256": NEW_SHA256,
		});

		t.equal(orphanData2, null, "Orphan data should be removed from the database.");

		const score = await db.scores.findOne({
			game: "bms",
			userID: 3,
		});

		t.hasStrict(score, {
			scoreData: {
				score: 1004,
			},
			importType: "ir/beatoraja",
		});

		t.end();
	});

	t.test("Should require authentication.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.send(MockBeatorajaBMSScore);

		t.equal(res.status, 401);

		t.end();
	});

	t.test("Should reject non-corresponding tokens.", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-score")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer invalid_token")

			.send(MockBeatorajaBMSScore);

		t.equal(res.status, 401);

		t.end();
	});

	t.end();
});

const courseScore = {
	course: {
		name: "GENOSIDE 2018 段位認定 発狂皆伝",
		charts: [
			{
				md5: "cfad3baadce9e02c45021963453d7c94",
			},
			{
				md5: "77d23be22b2370925c573d922276bce0",
			},
			{
				md5: "188a99f74ab71804f2e360dcf484545c",
			},
			{
				md5: "c46a81cb184f5a804c119930d6eba748",
			},
		],
		constraint: ["MIRROR", "GAUGE_LR2", "LN"],
		trophy: [{}, {}],
		lntype: 0,
	},
	score: {
		sha256: "",
		lntype: 0,
		player: "unknown",
		clear: "Normal",
		date: 0,
		epg: 1334,
		lpg: 788,
		egr: 1634,
		lgr: 382,
		egd: 239,
		lgd: 142,
		ebd: 34,
		lbd: 8,
		epr: 0,
		lpr: 93,
		ems: 63,
		lms: 74,
		maxcombo: 225,
		notes: 6005,
		passnotes: 4654,
		minbp: 1623,
		option: 0,
		assist: 0,
		gauge: 0,
		deviceType: "BM_CONTROLLER",
		judgeAlgorithm: "Combo",
		rule: "Beatoraja_7",
		exscore: 6260,
	},
};

t.test("POST /ir/beatoraja/submit-course", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(() =>
		db["api-tokens"].insert({
			userID: 1,
			identifier: "Mock API Beatoraja Token",
			permissions: {
				submit_score: true,
			},
			token: "mock_token",
			fromAPIClient: null,
		})
	);

	t.test("Should accept a valid clear", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(courseScore);

		t.equal(res.status, 200);
		t.equal(res.body.success, true);
		t.equal(res.body.description, "Successfully updated class.");

		const ugs = await db["game-stats"].findOne({ userID: 1, game: "bms", playtype: "7K" });

		t.equal(ugs?.classes.genocideDan, "OVERJOY", "Should set their dan to overjoy.");

		t.end();
	});

	t.test("Should silently reject a fail", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(courseScore, { score: { clear: "Failed" } }));

		t.equal(res.status, 200);
		t.equal(res.body.success, true);
		t.equal(res.body.description, "Class not updated, as you didn't clear this course.");

		t.end();
	});

	t.test("Should reject scores with no charts", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(courseScore, { course: { charts: [] } }, { arrayMerge: (d, s) => s }));

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(
			res.body.description,
			"[course.charts] Expected an array of 4 objects with MD5 properties."
		);

		t.end();
	});

	t.test("Should reject scores with invalid chart documents", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(courseScore, { course: { charts: [1, 2, 3, 4] } }));

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(
			res.body.description,
			"[course.charts] Expected an array of 4 objects with MD5 properties."
		);

		t.end();
	});

	t.test("Should reject scores with too many chart documents", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(courseScore, {
					course: {
						charts: [
							{ md5: "a" },
							{ md5: "a" },
							{ md5: "a" },
							{ md5: "a" },
							{ md5: "a" },
						],
					},
				})
			);

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(
			res.body.description,
			"[course.charts] Expected an array of 4 objects with MD5 properties."
		);

		t.end();
	});

	t.test("Should reject scores not on LN mode", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(courseScore, {
					score: {
						lntype: 1,
					},
				})
			);

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(res.body.description, "LN mode is the only supported mode for dans.");

		t.end();
	});

	t.test("Should reject non-array constraints", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(
					courseScore,
					{
						course: {
							constraint: "foo",
						},
					},
					{ arrayMerge: (d, s) => s }
				)
			);

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(res.body.description, "[course.constraint] Value was not an array. (Received foo)");

		t.end();
	});

	t.test("Should reject invalid non lr2 gauge", async (t) => {
		const res = await mockApi
			.post("/ir/beatoraja/submit-course")
			.set("X-TachiIR-Version", "v2.0.0")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(
					courseScore,
					{
						course: {
							constraint: ["GAUGE_5KEY", "MIRROR"],
						},
					},
					{ arrayMerge: (d, s) => s }
				)
			);

		t.equal(res.status, 400);
		t.equal(res.body.success, false);
		t.equal(res.body.description, "Dan GAUGE mode must be GAUGE_LR2.");

		t.end();
	});

	t.end();
});
