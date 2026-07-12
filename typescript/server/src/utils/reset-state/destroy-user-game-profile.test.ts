import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

describe("DestroyUserGameProfile (DELETE .../games/:game)", () => {
	it("drops import_session when sessions are wiped (session_id ON DELETE CASCADE)", async () => {
		const { id: userId, username } = await seedUser({
			username: `wipe_import_sess_${Date.now()}`,
			withCredential: true,
			withSettings: true,
		});

		await DB.insertInto("game_profile")
			.values({
				user_id: userId,
				game: "iidx-sp",
				ratings: JSON.stringify({}),
				classes: JSON.stringify({}),
			})
			.execute();

		const sessionId = "sess-import-fk-regression";
		const importId = "import-fk-regression";
		const t = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "wipe-me",
				description: null,
				time_inserted: t,
				time_started: t,
				time_ended: t,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		await DB.insertInto("import")
			.values({
				id: importId,
				user_id: userId,
				time_started: t,
				time_finished: t,
				game_group: "iidx",
				import_type: "file/batch-manual",
				user_intent: true,
				service: "test",
			})
			.execute();

		await DB.insertInto("import_game").values({ id: importId, game: "iidx-sp" }).execute();

		await DB.insertInto("import_session")
			.values({
				import_id: importId,
				session_id: sessionId,
				type: "created",
			})
			.execute();

		const cookie = await loginAs(username);

		const wipe = await mockApi
			.delete(`/api/v1/users/${userId}/games/iidx-sp`)
			.set("Cookie", cookie)
			.send({ "!password": "password123" });

		expect(wipe.status).toBe(200);

		const sess = await DB.selectFrom("session")
			.select("session.id")
			.where("session.id", "=", sessionId)
			.executeTakeFirst();

		expect(sess).toBeUndefined();

		const link = await DB.selectFrom("import_session")
			.select("import_session.row_id")
			.where("import_session.session_id", "=", sessionId)
			.executeTakeFirst();

		expect(link).toBeUndefined();
	});
});
