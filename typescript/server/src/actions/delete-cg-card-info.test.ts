import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_DeleteCgCardInfo } from "./delete-cg-card-info";

const CARD_A = "ABCDEFGHIJKLMNOP";
const CARD_B = "0123456789ABCDEF";
const PIN_A = "1234";
const PIN_B = "5678";

async function getCgCardRow(userId: number, service: "dev" | "gan" | "nag") {
	return DB.selectFrom("priv_svc_cg_card_info")
		.selectAll()
		.where("user_id", "=", userId)
		.where("service", "=", service)
		.executeTakeFirst();
}

describe("ACTION_DeleteCgCardInfo", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	it("returns {} when no row exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteCgCardInfo(taker, { service: "dev" });

		expect(result).toEqual({});
	});

	it("deletes the user's row for that service when present", async () => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "dev", card_id: CARD_A, pin: PIN_A })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteCgCardInfo(taker, { service: "dev" });

		expect(await getCgCardRow(userId, "dev")).toBeUndefined();
	});

	it("does not delete another service's row", async () => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "dev", card_id: CARD_A, pin: PIN_A })
			.execute();
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "gan", card_id: CARD_B, pin: PIN_B })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteCgCardInfo(taker, { service: "dev" });

		expect(await getCgCardRow(userId, "gan")).toBeDefined();
	});

	it("does not delete another user's row", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "dev", card_id: CARD_A, pin: PIN_A })
			.execute();
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: other.id, service: "dev", card_id: CARD_B, pin: PIN_B })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteCgCardInfo(taker, { service: "dev" });

		expect(await getCgCardRow(other.id, "dev")).toBeDefined();
	});

	it("writes a GOOD action row on success when a row was deleted", async () => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "dev", card_id: CARD_A, pin: PIN_A })
			.execute();

		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteCgCardInfo(taker, { service: "dev" });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_CG_CARD_INFO")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_CG_CARD_INFO",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
