import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { type UserGameStats } from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

import { MANUAL_CLASS_IMPORT_OPTIONS } from "./class-process-options";
import { CalculateUGPTClasses, ProcessClassDeltas } from "./classes";

describe("CalculateUGPTClasses", () => {
	it("produces an empty object when there are no derived or custom classes", async () => {
		const res = await CalculateUGPTClasses("iidx-sp", 1, {}, null, log);

		expect(res).toEqual({});
	});

	it("merges classes from the ClassProvider", async () => {
		const res = await CalculateUGPTClasses(
			"iidx-sp",
			1,
			{},
			async () => ({ dan: "DAN_2" }),
			log,
		);

		expect(res).toEqual({ dan: "DAN_2" });
	});

	it("applies static derived handlers when present", async () => {
		const res = await CalculateUGPTClasses("gitadora-dora", 1, { naiveSkill: 9000 }, null, log);

		expect(res).toEqual({ colour: "RAINBOW" });
	});
});

describe("ProcessClassDeltas", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "class_delta_tester",
			withCredential: true,
			withSettings: true,
		}));
	});

	it("returns improved classes from null user stats", async () => {
		const res = await ProcessClassDeltas("iidx-sp", { dan: "KAIDEN" }, null, userId, log);

		expect(res).toEqual([
			{
				game: "iidx-sp",
				set: "dan",
				old: null,
				new: "KAIDEN",
			},
		]);
	});

	it("returns improved classes when existing stats have no classes", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "KAIDEN" },
			{ classes: {} } as UserGameStats,
			userId,
			log,
		);

		expect(res).toEqual([
			{
				game: "iidx-sp",
				set: "dan",
				old: null,
				new: "KAIDEN",
			},
		]);
	});

	it("returns improved classes when the new value ranks higher", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "KAIDEN" },
			{ classes: { dan: "CHUUDEN" } } as unknown as UserGameStats,
			userId,
			log,
		);

		expect(res).toEqual([
			{
				game: "iidx-sp",
				set: "dan",
				old: "CHUUDEN",
				new: "KAIDEN",
			},
		]);
	});

	it("returns no deltas when classes are unchanged", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "KAIDEN" },
			{ classes: { dan: "KAIDEN" } } as unknown as UserGameStats,
			userId,
			log,
		);

		expect(res).toEqual([]);
	});

	it("does not downgrade provided classes", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "DAN_10" },
			{ classes: { dan: "KAIDEN" } } as unknown as UserGameStats,
			userId,
			log,
		);

		expect(res).toEqual([]);
	});

	it("allows downgrade for downgradable derived classes", async () => {
		const res = await ProcessClassDeltas(
			"sdvx",
			{ vfClass: "DANDELION_I" },
			{ classes: { vfClass: "DANDELION_II" } } as unknown as UserGameStats,
			userId,
			log,
		);

		expect(res).toEqual([
			{
				game: "sdvx",
				set: "vfClass",
				old: "DANDELION_II",
				new: "DANDELION_I",
			},
		]);
	});

	it("allows downgrade for provided classes when manual import options are set", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "DAN_10" },
			{ classes: { dan: "KAIDEN" } } as unknown as UserGameStats,
			userId,
			log,
			MANUAL_CLASS_IMPORT_OPTIONS,
		);

		expect(res).toEqual([
			{
				game: "iidx-sp",
				set: "dan",
				old: "KAIDEN",
				new: "DAN_10",
			},
		]);
	});

	it("manual import may clear PROVIDED class with null merged value", async () => {
		const res = await ProcessClassDeltas(
			"iidx-sp",
			{ dan: null },
			{ classes: { dan: "KAIDEN" } } as unknown as UserGameStats,
			userId,
			log,
			MANUAL_CLASS_IMPORT_OPTIONS,
		);

		expect(res).toStrictEqual([
			{
				game: "iidx-sp",
				set: "dan",
				old: "KAIDEN",
				new: null,
			},
		]);
	});

	it("writes manual source to class_achievement for manual imports", async () => {
		await ProcessClassDeltas(
			"iidx-sp",
			{ dan: "KAIDEN" },
			null,
			userId,
			log,
			MANUAL_CLASS_IMPORT_OPTIONS,
		);

		const row = await DB.selectFrom("class_achievement")
			.select(["source", "class_value"])
			.where("user_id", "=", userId)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		expect(row.source).toBe("manual");
		expect(row.class_value).toBe("KAIDEN");
	});
});
