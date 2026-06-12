import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

let counter = 0;

async function seedIidxSpProfile(userId: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
		})
		.execute();
}

async function insertSession(opts: {
	calculatedData: Record<string, number>;
	highlight?: boolean;
	id: string;
	name: string;
	timeEndedIso: string;
	timeStartedIso?: string;
	userId: number;
}) {
	await DB.insertInto("session")
		.values({
			id: opts.id,
			user_id: opts.userId,
			game: "iidx-sp",
			name: opts.name,
			description: null,
			time_inserted: opts.timeEndedIso,
			time_started: opts.timeStartedIso ?? opts.timeEndedIso,
			time_ended: opts.timeEndedIso,
			calculated_data: JSON.stringify(opts.calculatedData),
			highlight: opts.highlight ?? false,
		})
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/sessions", () => {
	it("returns 400 when search query is missing or not a string", async () => {
		const { id: userId } = await seedUser({ username: `sess_search_bad_${++counter}` });
		await seedIidxSpProfile(userId);

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions`);

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns name-matched sessions for Postgres-backed search", async () => {
		const { id: userId } = await seedUser({ username: `sess_search_ok_${++counter}` });
		await seedIidxSpProfile(userId);

		const id = `sess-search-${counter}`;

		await insertSession({
			userId,
			id,
			name: "UniqueFlowerSession",
			calculatedData: {},
			timeEndedIso: new Date().toISOString(),
		});

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/sessions?search=Flower`,
		);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.some((s: { sessionID: string }) => s.sessionID === id)).toBe(true);
	});
});

describe("GET /api/v1/users/:userID/games/:game/sessions/best", () => {
	it("sorts sessions by default session rating alg from calculated_data", async () => {
		const { id: userId } = await seedUser({ username: `sess_best_${++counter}` });
		await seedIidxSpProfile(userId);

		const low = `sess-best-low-${counter}`;
		const high = `sess-best-high-${counter}`;
		const t = new Date().toISOString();

		await insertSession({
			userId,
			id: low,
			name: "L",
			calculatedData: { ktLampRating: 1 },
			timeEndedIso: t,
		});

		await insertSession({
			userId,
			id: high,
			name: "H",
			calculatedData: { ktLampRating: 99 },
			timeEndedIso: t,
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/best`);

		expect(res.status).toBe(200);
		expect(res.body.body[0].sessionID).toBe(high);
		expect(res.body.body[1].sessionID).toBe(low);
	});

	it("returns 400 for an invalid alg query", async () => {
		const { id: userId } = await seedUser({ username: `sess_alg_${++counter}` });
		await seedIidxSpProfile(userId);

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/sessions/best?alg=not_a_real_alg`,
		);

		expect(res.status).toBe(400);
	});
});

describe("GET /api/v1/users/:userID/games/:game/sessions/highlighted", () => {
	it("returns only highlighted sessions", async () => {
		const { id: userId } = await seedUser({ username: `sess_hi_${++counter}` });
		await seedIidxSpProfile(userId);

		const t = new Date().toISOString();

		await insertSession({
			userId,
			id: `sess-hi-yes-${counter}`,
			name: "Y",
			calculatedData: {},
			highlight: true,
			timeEndedIso: t,
		});

		await insertSession({
			userId,
			id: `sess-hi-no-${counter}`,
			name: "N",
			calculatedData: {},
			highlight: false,
			timeEndedIso: t,
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/highlighted`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].sessionID).toBe(`sess-hi-yes-${counter}`);
	});
});

describe("GET /api/v1/users/:userID/games/:game/sessions/recent", () => {
	it("orders sessions by timeEnded descending", async () => {
		const { id: userId } = await seedUser({ username: `sess_rec_${++counter}` });
		await seedIidxSpProfile(userId);

		const older = new Date("2020-01-01T00:00:00.000Z").toISOString();
		const newer = new Date("2021-06-01T00:00:00.000Z").toISOString();

		await insertSession({
			userId,
			id: `sess-old-${counter}`,
			name: "Old",
			calculatedData: {},
			timeEndedIso: older,
		});

		await insertSession({
			userId,
			id: `sess-new-${counter}`,
			name: "New",
			calculatedData: {},
			timeEndedIso: newer,
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/recent`);

		expect(res.status).toBe(200);
		expect(res.body.body[0].sessionID).toBe(`sess-new-${counter}`);
		expect(res.body.body[1].sessionID).toBe(`sess-old-${counter}`);
	});
});

describe("GET /api/v1/users/:userID/games/:game/sessions/last", () => {
	it("returns 404 when the user has no sessions for this game", async () => {
		const { id: userId } = await seedUser({ username: `sess_last_404_${++counter}` });
		await seedIidxSpProfile(userId);

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/last`);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns the most recent session by timeEnded", async () => {
		const { id: userId } = await seedUser({ username: `sess_last_ok_${++counter}` });
		await seedIidxSpProfile(userId);

		const older = new Date("2019-01-01T00:00:00.000Z").toISOString();
		const newer = new Date("2022-01-01T00:00:00.000Z").toISOString();

		await insertSession({
			userId,
			id: `sess-last-old-${counter}`,
			name: "O",
			calculatedData: {},
			timeEndedIso: older,
		});

		await insertSession({
			userId,
			id: `sess-last-new-${counter}`,
			name: "N",
			calculatedData: {},
			timeEndedIso: newer,
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/last`);

		expect(res.status).toBe(200);
		expect(res.body.body.session.sessionID).toBe(`sess-last-new-${counter}`);
		expect(Array.isArray(res.body.body.scoreInfo)).toBe(true);
	});
});

describe("GET /api/v1/users/:userID/games/:game/sessions/calendar", () => {
	it("returns slim session objects for the calendar view", async () => {
		const { id: userId } = await seedUser({ username: `sess_cal_${++counter}` });
		await seedIidxSpProfile(userId);

		const sid = `sess-cal-${counter}`;
		const t = new Date().toISOString();

		await insertSession({
			userId,
			id: sid,
			name: "Cal",
			calculatedData: {},
			timeEndedIso: t,
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/sessions/calendar`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		const ev = res.body.body[0];

		expect(ev.sessionID).toBe(sid);
		expect(ev.name).toBe("Cal");
		expect(ev.game).toBe("iidx-sp");
		expect(ev).not.toHaveProperty("playtype");
		expect(ev).not.toHaveProperty("scoreIDs");
		expect(ev).not.toHaveProperty("calculatedData");
	});
});
