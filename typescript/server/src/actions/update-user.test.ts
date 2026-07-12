import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_UpdateUser } from "./update-user";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccountRow(userId: number) {
	return DB.selectFrom("account")
		.select([
			"about",
			"status",
			"sm_discord",
			"sm_twitter",
			"sm_github",
			"sm_steam",
			"sm_youtube",
			"sm_twitch",
		])
		.where("id", "=", userId)
		.executeTakeFirstOrThrow();
}

// ─── ACTION_UpdateUser ────────────────────────────────────────────────────────

describe("ACTION_UpdateUser", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── Empty body guard ──────────────────────────────────────────────────────

	it("throws 400 when no fields are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateUser(taker, {})).rejects.toMatchObject({ code: 400 });
	});

	it("writes a BAD action row when no fields are provided", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_UpdateUser(taker, {})).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "UPDATE_USER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns an empty object on success", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_UpdateUser(taker, { about: "Hello world" });

		expect(result).toEqual({});
	});

	it("persists an updated about field", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { about: "New bio text" });

		const row = await getAccountRow(userId);

		expect(row.about).toBe("New bio text");
	});

	it("persists an updated status field", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { status: "Playing IIDX" });

		const row = await getAccountRow(userId);

		expect(row.status).toBe("Playing IIDX");
	});

	it("persists a null status field", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { status: null });

		const row = await getAccountRow(userId);

		expect(row.status).toBeNull();
	});

	it("persists an updated discord handle", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { discord: "myhandle#1234" });

		const row = await getAccountRow(userId);

		expect(row.sm_discord).toBe("myhandle#1234");
	});

	it("persists an updated github handle", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { github: "zkldi" });

		const row = await getAccountRow(userId);

		expect(row.sm_github).toBe("zkldi");
	});

	it("persists an updated twitter handle", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { twitter: "zkrdi" });

		const row = await getAccountRow(userId);

		expect(row.sm_twitter).toBe("zkrdi");
	});

	it("persists an updated twitch handle", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { twitch: "mystream" });

		const row = await getAccountRow(userId);

		expect(row.sm_twitch).toBe("mystream");
	});

	it("persists an updated steam id", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { steam: "76561198000000000" });

		const row = await getAccountRow(userId);

		expect(row.sm_steam).toBe("76561198000000000");
	});

	it("persists an updated youtube handle", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { youtube: "mychannel" });

		const row = await getAccountRow(userId);

		expect(row.sm_youtube).toBe("mychannel");
	});

	it("persists multiple fields updated in a single call", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, {
			about: "Multi-update bio",
			discord: "multiuser#0001",
			status: "Busy",
		});

		const row = await getAccountRow(userId);

		expect(row.about).toBe("Multi-update bio");
		expect(row.sm_discord).toBe("multiuser#0001");
		expect(row.status).toBe("Busy");
	});

	// ── URL stripping ─────────────────────────────────────────────────────────

	it("strips https://twitter.com/ prefix from twitter", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { twitter: "https://twitter.com/myhandle" });

		const row = await getAccountRow(userId);

		expect(row.sm_twitter).toBe("myhandle");
	});

	it("strips https://github.com/ prefix from github", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { github: "https://github.com/zkldi" });

		const row = await getAccountRow(userId);

		expect(row.sm_github).toBe("zkldi");
	});

	it("strips https://twitch.tv/ prefix from twitch", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { twitch: "https://twitch.tv/mystream" });

		const row = await getAccountRow(userId);

		expect(row.sm_twitch).toBe("mystream");
	});

	it("strips https://steamcommunity.com/id/ prefix from steam", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { steam: "https://steamcommunity.com/id/myid" });

		const row = await getAccountRow(userId);

		expect(row.sm_steam).toBe("myid");
	});

	it("strips the youtube.com/user/ prefix from youtube", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { youtube: "https://youtube.com/user/mychannel" });

		const row = await getAccountRow(userId);

		expect(row.sm_youtube).toBe("mychannel");
	});

	it("strips the youtube.com/channel/ prefix from youtube", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { youtube: "https://youtube.com/channel/UCmychannel" });

		const row = await getAccountRow(userId);

		expect(row.sm_youtube).toBe("UCmychannel");
	});

	it("strips the youtube.com/@ prefix from youtube", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { youtube: "https://youtube.com/@mychannel" });

		const row = await getAccountRow(userId);

		expect(row.sm_youtube).toBe("mychannel");
	});

	it("leaves a bare youtube handle untouched", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { youtube: "mychannel" });

		const row = await getAccountRow(userId);

		expect(row.sm_youtube).toBe("mychannel");
	});

	it("does not strip urls from a null social media field", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { twitter: null });

		const row = await getAccountRow(userId);

		expect(row.sm_twitter).toBeNull();
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not modify other users' account rows", async () => {
		const other = await seedUser({ username: "other_user" });
		const otherBefore = await getAccountRow(other.id);

		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };
		await ACTION_UpdateUser(taker, { about: "Updated bio" });

		const otherAfter = await getAccountRow(other.id);

		expect(otherAfter).toEqual(otherBefore);
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row to the audit log on success", async () => {
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { about: "Audit test" });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_USER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "UPDATE_USER",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});

	it("records the provided fields in the audit log input", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_UpdateUser(taker, { about: "Audit input test", discord: "disc#0001" });

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "UPDATE_USER")
			.executeTakeFirstOrThrow();

		const input = action.input as Record<string, unknown>;

		expect(input).toMatchObject({ about: "Audit input test", discord: "disc#0001" });
	});
});
