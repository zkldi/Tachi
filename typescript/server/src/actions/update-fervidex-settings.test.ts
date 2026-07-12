import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UpdateFervidexSettings } from "./update-fervidex-settings";

async function getFerSettings(userId: number) {
	return DB.selectFrom("svc_fer_settings")
		.selectAll()
		.where("user_id", "=", userId)
		.executeTakeFirst();
}

async function getFerCards(userId: number) {
	const rows = await DB.selectFrom("priv_svc_fer_card")
		.select(["priv_svc_fer_card.card_id"])
		.where("user_id", "=", userId)
		.execute();

	return rows.map((r) => r.card_id);
}

async function seedFerSettings(userId: number, forceStaticImport: boolean) {
	await DB.insertInto("svc_fer_settings")
		.values({ user_id: userId, force_static_import: forceStaticImport })
		.execute();
}

async function seedFerCards(userId: number, cards: Array<string>) {
	if (cards.length === 0) {
		return;
	}
	await DB.insertInto("priv_svc_fer_card")
		.values(cards.map((card_id) => ({ user_id: userId, card_id })))
		.execute();
}

describe("ACTION_UpdateFervidexSettings", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Insert (no existing row) ───────────────────────────────────────────────

	it("creates a new settings row when updating forceStaticImport and none exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: true });

		const row = await getFerSettings(userId);
		expect(row).toBeDefined();
		expect(row!.force_static_import).toBe(true);
	});

	it("defaults forceStaticImport to false when only cards are provided and no row exists", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: ["CARD_A"] });

		const row = await getFerSettings(userId);
		expect(row!.force_static_import).toBe(false);
	});

	it("inserts cards when provided on a new row", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: ["CARD_A", "CARD_B"] });

		expect(await getFerCards(userId)).toEqual(expect.arrayContaining(["CARD_A", "CARD_B"]));
	});

	// ── Update forceStaticImport ───────────────────────────────────────────────

	it("updates forceStaticImport on an existing row", async () => {
		await seedFerSettings(userId, false);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: true });

		const row = await getFerSettings(userId);
		expect(row!.force_static_import).toBe(true);
	});

	it("preserves forceStaticImport when only cards are updated", async () => {
		await seedFerSettings(userId, true);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: ["CARD_X"] });

		const row = await getFerSettings(userId);
		expect(row!.force_static_import).toBe(true);
	});

	// ── Update cards ───────────────────────────────────────────────────────────

	it("replaces existing cards when new cards are provided", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["OLD_CARD"]);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: ["NEW_CARD"] });

		const cards = await getFerCards(userId);
		expect(cards).toEqual(["NEW_CARD"]);
	});

	it("clears card filters when cards is null", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["CARD_A", "CARD_B"]);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: null });

		expect(await getFerCards(userId)).toHaveLength(0);
	});

	it("clears card filters when cards is an empty array", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["CARD_A"]);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { cards: [] });

		expect(await getFerCards(userId)).toHaveLength(0);
	});

	it("preserves existing cards when cards field is undefined", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["CARD_A", "CARD_B"]);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: true });

		const cards = await getFerCards(userId);
		expect(cards).toEqual(expect.arrayContaining(["CARD_A", "CARD_B"]));
	});

	// ── Combined update ────────────────────────────────────────────────────────

	it("updates both forceStaticImport and cards in a single call", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["OLD"]);
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, {
			forceStaticImport: true,
			cards: ["NEW_A", "NEW_B"],
		});

		const row = await getFerSettings(userId);
		expect(row!.force_static_import).toBe(true);
		expect(await getFerCards(userId)).toEqual(expect.arrayContaining(["NEW_A", "NEW_B"]));
	});

	// ── Return value ───────────────────────────────────────────────────────────

	it("returns the updated document with the caller's userID", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateFervidexSettings(taker, {
			cards: ["CARD_A"],
			forceStaticImport: true,
		});

		expect(result).toEqual({
			userID: userId,
			cards: ["CARD_A"],
			forceStaticImport: true,
		});
	});

	it("returns null cards when no card filters are set", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: false });

		expect(result.cards).toBeNull();
	});

	// ── Idempotency / duplicate rows ───────────────────────────────────────────

	it("does not create a second settings row on repeated calls", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: false });
		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: true });

		const { count } = await DB.selectFrom("svc_fer_settings")
			.select(DB.fn.countAll().as("count"))
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(count)).toBe(1);
	});

	// ── Isolation ──────────────────────────────────────────────────────────────

	it("does not affect another user's settings", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		await seedFerSettings(other.id, true);
		await seedFerCards(other.id, ["OTHER_CARD"]);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_UpdateFervidexSettings(taker, {
			forceStaticImport: false,
			cards: ["MY_CARD"],
		});

		const otherRow = await getFerSettings(other.id);
		expect(otherRow!.force_static_import).toBe(true);
		expect(await getFerCards(other.id)).toEqual(["OTHER_CARD"]);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateFervidexSettings(taker, { forceStaticImport: true });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_FERVIDEX_SETTINGS")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_FERVIDEX_SETTINGS",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
