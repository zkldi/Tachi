import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { GetImportTimestop, SetImportTimestop } from "./timestop";

describe("GetImportTimestop", () => {
	let userID: number;

	beforeEach(async () => {
		({ id: userID } = await seedUser());
	});

	it("returns null when no row exists", async () => {
		const result = await GetImportTimestop(userID, "api/eag-iidx");

		expect(result).toBeNull();
	});

	it("returns the stored date after SetImportTimestop", async () => {
		const time = new Date("2025-03-15T12:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", time);

		const result = await GetImportTimestop(userID, "api/eag-iidx");

		expect(result).not.toBeNull();
		expect(result!.getTime()).toBe(time.getTime());
	});

	it("is scoped per import type", async () => {
		const time = new Date("2025-01-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", time);

		expect(await GetImportTimestop(userID, "api/eag-sdvx")).toBeNull();
	});

	it("is scoped per user", async () => {
		const other = await seedUser({ username: "other_user" });
		const time = new Date("2025-01-01T00:00:00.000Z");

		await SetImportTimestop(other.id, "api/eag-iidx", time);

		expect(await GetImportTimestop(userID, "api/eag-iidx")).toBeNull();
	});
});

describe("SetImportTimestop", () => {
	let userID: number;

	beforeEach(async () => {
		({ id: userID } = await seedUser());
	});

	it("inserts a new row when none exists", async () => {
		const time = new Date("2025-06-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/flo-sdvx", time);

		const row = await DB.selectFrom("import_timestop")
			.select(["import_timestop.last_score_time"])
			.where("import_timestop.user_id", "=", userID)
			.where("import_timestop.import_type", "=", "api/flo-sdvx")
			.executeTakeFirst();

		expect(row).toBeDefined();
		expect(new Date(row!.last_score_time).getTime()).toBe(time.getTime());
	});

	it("advances the cursor to a later timestamp", async () => {
		const t1 = new Date("2025-01-01T00:00:00.000Z");
		const t2 = new Date("2025-06-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", t1);
		await SetImportTimestop(userID, "api/eag-iidx", t2);

		const result = await GetImportTimestop(userID, "api/eag-iidx");

		expect(result!.getTime()).toBe(t2.getTime());
	});

	it("does not go backwards when called with an earlier timestamp", async () => {
		const t1 = new Date("2025-06-01T00:00:00.000Z");
		const t2 = new Date("2025-01-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", t1);
		await SetImportTimestop(userID, "api/eag-iidx", t2);

		const result = await GetImportTimestop(userID, "api/eag-iidx");

		// GREATEST keeps t1
		expect(result!.getTime()).toBe(t1.getTime());
	});

	it("only maintains one row per (user, import_type)", async () => {
		const t1 = new Date("2025-01-01T00:00:00.000Z");
		const t2 = new Date("2025-06-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", t1);
		await SetImportTimestop(userID, "api/eag-iidx", t2);

		const count = await DB.selectFrom("import_timestop")
			.select(DB.fn.countAll().as("count"))
			.where("import_timestop.user_id", "=", userID)
			.where("import_timestop.import_type", "=", "api/eag-iidx")
			.executeTakeFirstOrThrow();

		expect(Number(count.count)).toBe(1);
	});

	it("does not affect other users", async () => {
		const other = await seedUser({ username: "other_user" });
		const myTime = new Date("2025-01-01T00:00:00.000Z");
		const theirTime = new Date("2026-01-01T00:00:00.000Z");

		await SetImportTimestop(userID, "api/eag-iidx", myTime);
		await SetImportTimestop(other.id, "api/eag-iidx", theirTime);

		const myResult = await GetImportTimestop(userID, "api/eag-iidx");
		const theirResult = await GetImportTimestop(other.id, "api/eag-iidx");

		expect(myResult!.getTime()).toBe(myTime.getTime());
		expect(theirResult!.getTime()).toBe(theirTime.getTime());
	});
});
