import { SELECT_ACTION } from "#lib/db-formats/action";
import { SELECT_USER_SETTINGS } from "#lib/db-formats/user-settings";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UpdateUserSettings } from "./update-user-settings";

async function getSettings(userId: number) {
	return DB.selectFrom("account_settings")
		.select(SELECT_USER_SETTINGS)
		.where("account_settings.user_id", "=", userId)
		.executeTakeFirstOrThrow();
}

describe("ACTION_UpdateUserSettings", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({
			username: "test_user",
			withSettings: true,
		}));
	});

	it("throws 400 when no fields are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateUserSettings(taker, {})).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when no fields are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateUserSettings(taker, {})).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "UPDATE_USER_SETTINGS")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("returns {} on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateUserSettings(taker, { invisible: true });

		expect(result).toEqual({});
	});

	it("persists invisible to pf_invisible", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { invisible: true });

		const row = await getSettings(userId);
		expect(row.pf_invisible).toBe(true);
		expect(row.pf_developer_mode).toBe(false);
		expect(row.pf_advanced_mode).toBe(false);
		expect(row.pf_contentious_content).toBe(false);
		expect(row.pf_deletable_scores).toBe(false);
	});

	it("persists developerMode to pf_developer_mode", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { developerMode: true });

		const row = await getSettings(userId);
		expect(row.pf_developer_mode).toBe(true);
		expect(row.pf_invisible).toBe(false);
	});

	it("persists contentiousContent to pf_contentious_content", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { contentiousContent: true });

		const row = await getSettings(userId);
		expect(row.pf_contentious_content).toBe(true);
	});

	it("persists advancedMode to pf_advanced_mode", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { advancedMode: true });

		const row = await getSettings(userId);
		expect(row.pf_advanced_mode).toBe(true);
	});

	it("persists deletableScores to pf_deletable_scores", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { deletableScores: true });

		const row = await getSettings(userId);
		expect(row.pf_deletable_scores).toBe(true);
	});

	it("updates multiple fields in one call and leaves others unchanged", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, {
			invisible: true,
			developerMode: true,
		});

		const row = await getSettings(userId);
		expect(row.pf_invisible).toBe(true);
		expect(row.pf_developer_mode).toBe(true);
		expect(row.pf_advanced_mode).toBe(false);
		expect(row.pf_contentious_content).toBe(false);
		expect(row.pf_deletable_scores).toBe(false);
	});

	it("does not modify another user's account_settings", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withSettings: true,
		});
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { invisible: true });

		const otherRow = await getSettings(other.id);
		expect(otherRow.pf_invisible).toBe(false);
	});

	it("writes a GOOD action row on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUserSettings(taker, { invisible: true });

		const action = await DB.selectFrom("action")
			.select(SELECT_ACTION)
			.where("action.kind", "=", "UPDATE_USER_SETTINGS")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_USER_SETTINGS",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
