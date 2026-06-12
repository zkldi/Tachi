import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_SetRivals } from "./set-rivals";

describe("ACTION_SetRivals", () => {
	let userId: number;
	let username: string;
	let rivalId: number;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: `rival_set_${Date.now()}` }));
		rivalId = (await seedUser({ username: `rival_target_${Date.now()}` })).id;

		const prefs = newGameProfilePreferenceColumns("iidx-sp");
		await DB.insertInto("game_profile")
			.values([
				{
					user_id: userId,
					game: "iidx-sp",
					ratings: JSON.stringify({}),
					classes: JSON.stringify({}),
					...prefs,
				},
				{
					user_id: rivalId,
					game: "iidx-sp",
					ratings: JSON.stringify({}),
					classes: JSON.stringify({}),
					...prefs,
				},
			])
			.execute();
	});

	it("replaces game_rival rows for the usergame", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_SetRivals(taker, {
			userID: userId,
			game: "iidx-sp",
			rivalIDs: [rivalId],
		});

		const rows = await DB.selectFrom("game_rival")
			.selectAll()
			.where("user_id", "=", userId)
			.where("game", "=", "iidx-sp")
			.execute();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.rival).toBe(rivalId);
	});

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.3", acct: { id: userId, username } };

		await ACTION_SetRivals(taker, {
			userID: userId,
			game: "iidx-sp",
			rivalIDs: [rivalId],
		});

		const actionRow = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "SET_RIVALS")
			.executeTakeFirstOrThrow();

		expect(actionRow).toMatchObject({ result: "GOOD", ip: "10.0.0.3", user_id: userId });
	});

	it("throws 403 when targeting another user as non-admin", async () => {
		const other = await seedUser({ username: `other_rival_${Date.now()}` });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_SetRivals(taker, {
				userID: other.id,
				game: "iidx-sp",
				rivalIDs: [rivalId],
			}),
		).rejects.toMatchObject({ code: 403 });
	});

	it("throws 400 when rivaling yourself", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_SetRivals(taker, {
				userID: userId,
				game: "iidx-sp",
				rivalIDs: [userId],
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when more than MAX_RIVALS rivals are set", async () => {
		const main = await seedUser({ username: `too_many_${Date.now()}` });
		const rivalUsers = await Promise.all(
			Array.from({ length: ServerConfig.MAX_RIVALS + 1 }, (_, i) =>
				seedUser({ username: `too_many_r_${i}_${Date.now()}` }),
			),
		);

		const prefs = newGameProfilePreferenceColumns("iidx-sp");
		await DB.insertInto("game_profile")
			.values([
				{
					user_id: main.id,
					game: "iidx-sp",
					ratings: JSON.stringify({}),
					classes: JSON.stringify({}),
					...prefs,
				},
				...rivalUsers.map((u) => ({
					user_id: u.id,
					game: "iidx-sp" as const,
					ratings: JSON.stringify({}),
					classes: JSON.stringify({}),
					...prefs,
				})),
			])
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: main.id, username: main.username } };

		await expect(
			ACTION_SetRivals(taker, {
				userID: main.id,
				game: "iidx-sp",
				rivalIDs: rivalUsers.map((u) => u.id),
			}),
		).rejects.toMatchObject({ code: 400 });
	});
});
