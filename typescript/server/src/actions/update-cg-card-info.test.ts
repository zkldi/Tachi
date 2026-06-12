import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UpdateCgCardInfo } from "./update-cg-card-info";

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

describe("ACTION_UpdateCgCardInfo", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	it("returns {} on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateCgCardInfo(taker, {
			service: "dev",
			cardID: CARD_A,
			pin: PIN_A,
		});

		expect(result).toEqual({});
	});

	it("inserts a row on first call", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateCgCardInfo(taker, { service: "dev", cardID: CARD_A, pin: PIN_A });

		const row = await getCgCardRow(userId, "dev");
		expect(row).toMatchObject({
			user_id: userId,
			service: "dev",
			card_id: CARD_A,
			pin: PIN_A,
		});
	});

	it("updates card_id and pin on conflict for the same user and service", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateCgCardInfo(taker, { service: "gan", cardID: CARD_A, pin: PIN_A });
		await ACTION_UpdateCgCardInfo(taker, { service: "gan", cardID: CARD_B, pin: PIN_B });

		const row = await getCgCardRow(userId, "gan");
		expect(row?.card_id).toBe(CARD_B);
		expect(row?.pin).toBe(PIN_B);

		const { count } = await DB.selectFrom("priv_svc_cg_card_info")
			.select(DB.fn.countAll().as("count"))
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(count)).toBe(1);
	});

	it("stores separate rows per service", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateCgCardInfo(taker, { service: "dev", cardID: CARD_A, pin: PIN_A });
		await ACTION_UpdateCgCardInfo(taker, { service: "nag", cardID: CARD_B, pin: PIN_B });

		expect(await getCgCardRow(userId, "dev")).toMatchObject({ card_id: CARD_A });
		expect(await getCgCardRow(userId, "nag")).toMatchObject({ card_id: CARD_B });
	});

	it("does not modify another user's row", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await DB.insertInto("priv_svc_cg_card_info")
			.values({
				user_id: other.id,
				service: "dev",
				card_id: CARD_B,
				pin: PIN_B,
			})
			.execute();

		await ACTION_UpdateCgCardInfo(taker, { service: "dev", cardID: CARD_A, pin: PIN_A });

		const otherRow = await getCgCardRow(other.id, "dev");
		expect(otherRow?.card_id).toBe(CARD_B);
	});

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateCgCardInfo(taker, { service: "dev", cardID: CARD_A, pin: PIN_A });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_CG_CARD_INFO")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_CG_CARD_INFO",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
