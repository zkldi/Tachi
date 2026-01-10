import db from "external/mongo/db";
import t from "tap";
import { mkFakePBIIDXSP } from "test-utils/misc";
import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import { LoadTachiIIDXData, Testing511SPA } from "test-utils/test-data";

t.test("GET /api/v1/games/:game/:playtype/charts", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(LoadTachiIIDXData);

	t.test("Should return the most popular charts if no param is set.", async (t) => {
		await db["personal-bests"].insert([
			mkFakePBIIDXSP({
				chartID: Testing511SPA.chartID,
				userID: 1,
			}),
			mkFakePBIIDXSP({
				chartID: Testing511SPA.chartID,
				userID: 2,
			}),
			mkFakePBIIDXSP({
				chartID: Testing511SPA.chartID,
				userID: 3,
			}),
			mkFakePBIIDXSP({
				// gambol hyper
				songID: 7,
				chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
				userID: 1,
			}),
		]);

		const res = await mockApi.get("/api/v1/games/iidx/SP/charts");

		t.hasStrict(res.body.body.charts[0], {
			__playcount: 3,
			chartID: Testing511SPA.chartID,
		});

		t.hasStrict(res.body.body.charts[1], {
			__playcount: 1,
			chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
		});

		t.equal(res.body.body.charts.length, 100);

		t.end();
	});

	t.test("Should search charts if a search param is set.", async (t) => {
		await db["personal-bests"].insert([
			mkFakePBIIDXSP({
				// gambol hyper
				songID: 7,
				chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
				userID: 1,
			}),
		]);

		const res = await mockApi.get("/api/v1/games/iidx/SP/charts?search=gambol");

		t.hasStrict(res.body.body.charts[0], {
			__playcount: 1,
			chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
		});

		// gambol has SPB, SPN and SPH
		t.equal(res.body.body.charts.length, 3);

		t.end();
	});

	t.test(
		"Should only return charts the requester has played if requesterHasPlayed is set.",
		async (t) => {
			await db["personal-bests"].insert([
				mkFakePBIIDXSP({
					// gambol hyper
					songID: 7,
					chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
					userID: 2,
				}),
				mkFakePBIIDXSP({
					songID: 1,
					chartID: Testing511SPA.chartID,
					userID: 1,
				}),
			]);

			const res = await mockApi
				.get("/api/v1/games/iidx/SP/charts?requesterHasPlayed=true")
				.set("Authorization", "Bearer fake_api_token");

			t.hasStrict(res.body.body.charts[0], {
				__playcount: 1,
				chartID: Testing511SPA.chartID,
			});

			// The user has played 5.1.1., but not anything else loaded in the db.
			// note that this endpoint works on played songs, rather than played charts.
			t.equal(res.body.body.charts.length, 4);

			t.end();
		}
	);

	t.test(
		"Should only return charts the requester has played if requesterHasPlayed is set, and work with searches at the same time.",
		async (t) => {
			await db["personal-bests"].insert([
				mkFakePBIIDXSP({
					// gambol hyper
					songID: 7,
					chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
					userID: 1,
				}),
				mkFakePBIIDXSP({
					songID: 1,
					chartID: Testing511SPA.chartID,
					userID: 1,
				}),
			]);

			const res = await mockApi
				.get("/api/v1/games/iidx/SP/charts?requesterHasPlayed=true&search=gambol")
				.set("Authorization", "Bearer fake_api_token");

			t.hasStrict(res.body.body.charts[0], {
				__playcount: 1,
				chartID: "fc7edc6bcfa701a261c89c999ddbba3e2195597b",
			});

			// gambol has SPB, SPN and SPH, but only SPH has been played by the requester
			// although 5.1.1 has been played by the requester, it should not match the
			// search.
			t.equal(res.body.body.charts.length, 3);

			t.end();
		}
	);

	t.end();
});

t.test("POST /api/v1/games/:game/:playtype/charts/resolve", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(LoadTachiIIDXData);

	t.test("Should resolve a chart using tachiSongID matchType.", async (t) => {
		const res = await mockApi.post("/api/v1/games/iidx/SP/charts/resolve").send({
			matchType: "tachiSongID",
			identifier: "1",
			difficulty: "ANOTHER",
		});

		t.equal(res.statusCode, 200);
		t.equal(res.body.success, true);
		t.equal(res.body.body.chart.chartID, Testing511SPA.chartID);
		t.equal(res.body.body.song.id, 1);
		t.equal(res.body.body.song.title, "5.1.1.");

		t.end();
	});

	t.test("Should resolve a chart using songTitle matchType.", async (t) => {
		const res = await mockApi.post("/api/v1/games/iidx/SP/charts/resolve").send({
			matchType: "songTitle",
			identifier: "5.1.1.",
			difficulty: "ANOTHER",
		});

		t.equal(res.statusCode, 200);
		t.equal(res.body.success, true);
		t.equal(res.body.body.chart.chartID, Testing511SPA.chartID);
		t.equal(res.body.body.song.id, 1);

		t.end();
	});

	t.test("Should return 404 when chart cannot be resolved.", async (t) => {
		const res = await mockApi.post("/api/v1/games/iidx/SP/charts/resolve").send({
			matchType: "tachiSongID",
			identifier: "99999",
			difficulty: "ANOTHER",
		});

		t.equal(res.statusCode, 404);
		t.equal(res.body.success, false);
		t.match(res.body.description, /Could not resolve this chart/u);

		t.end();
	});

	t.test("Should return 400 for invalid request body.", async (t) => {
		const res = await mockApi.post("/api/v1/games/iidx/SP/charts/resolve").send({
			matchType: "invalidMatchType",
			identifier: "1",
		});

		t.equal(res.statusCode, 400);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should return 400 when required fields are missing.", async (t) => {
		const res = await mockApi.post("/api/v1/games/iidx/SP/charts/resolve").send({
			matchType: "tachiSongID",
			// missing identifier
		});

		t.equal(res.statusCode, 400);
		t.equal(res.body.success, false);

		t.end();
	});

	t.end();
});
