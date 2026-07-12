import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_DeleteMytCardInfo } from "./delete-myt-card-info";
import { ACTION_UpdateMytCardInfo } from "./update-myt-card-info";

const CODE_A = "00000000000000000001";
const CODE_B = "00000000000000000002";
const CODE_OTHER = "00000000000000009999";

async function getMytCardRow(userId: number) {
	return DB.selectFrom("priv_svc_myt_card_info")
		.selectAll()
		.where("user_id", "=", userId)
		.executeTakeFirst();
}

describe("ACTION_UpdateMytCardInfo", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	it("returns {} on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_A });

		expect(result).toEqual({});
	});

	it("inserts a row on first call", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_A });

		const row = await getMytCardRow(userId);
		expect(row).toMatchObject({ user_id: userId, card_access_code: CODE_A });
	});

	it("updates card_access_code on second call for the same user", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_A });
		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_B });

		const row = await getMytCardRow(userId);
		expect(row?.card_access_code).toBe(CODE_B);

		const { count } = await DB.selectFrom("priv_svc_myt_card_info")
			.select(DB.fn.countAll().as("count"))
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(count)).toBe(1);
	});

	it("does not modify another user's row", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: other.id, card_access_code: CODE_OTHER })
			.execute();

		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_A });

		const otherRow = await getMytCardRow(other.id);
		expect(otherRow?.card_access_code).toBe(CODE_OTHER);
	});

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: CODE_A });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_MYT_CARD_INFO")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_MYT_CARD_INFO",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});

describe("ACTION_DeleteMytCardInfo", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	it("returns {} when no row exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteMytCardInfo(taker, {});

		expect(result).toEqual({});
	});

	it("deletes the user's row when present", async () => {
		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: userId, card_access_code: CODE_A })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteMytCardInfo(taker, {});

		expect(await getMytCardRow(userId)).toBeUndefined();
	});

	it("does not delete another user's row", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: userId, card_access_code: CODE_A })
			.execute();
		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: other.id, card_access_code: CODE_OTHER })
			.execute();

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteMytCardInfo(taker, {});

		const otherRow = await getMytCardRow(other.id);
		expect(otherRow?.card_access_code).toBe(CODE_OTHER);
	});

	it("writes a GOOD action row on success when a row was deleted", async () => {
		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: userId, card_access_code: CODE_A })
			.execute();

		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteMytCardInfo(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_MYT_CARD_INFO")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_MYT_CARD_INFO",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
