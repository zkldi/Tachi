import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import ParseImportClass from "./parser";

describe("ParseImportClass", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: `import_class_parser_${Date.now()}`,
			withCredential: true,
			withSettings: true,
		}));
	});

	it("returns an empty iterable with a class provider when the user has a profile", async () => {
		await DB.insertInto("game_profile")
			.values({
				user_id: userId,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 0 }),
				classes: JSON.stringify({}),
			})
			.execute();

		const res = await ParseImportClass(userId, "iidx-sp", { dan: "CHUUDEN" }, log);

		expect(res.iterable).toEqual([]);
		expect(res.service).toBe("Manual Class Import");
		expect(res.gameGroup).toBe("iidx");
		expect(res.classProvider).not.toBeNull();
	});

	it("rejects users without a game profile", async () => {
		await expect(ParseImportClass(userId, "iidx-sp", { dan: "CHUUDEN" }, log)).rejects.toThrow(
			ScoreImportFatalError,
		);
	});

	it("rejects derived class sets", async () => {
		await DB.insertInto("game_profile")
			.values({
				user_id: userId,
				game: "sdvx",
				ratings: JSON.stringify({}),
				classes: JSON.stringify({}),
			})
			.execute();

		await expect(
			ParseImportClass(userId, "sdvx", { vfClass: "DANDELION_I" }, log),
		).rejects.toThrow(ScoreImportFatalError);
	});

	it("rejects empty class objects", async () => {
		await DB.insertInto("game_profile")
			.values({
				user_id: userId,
				game: "iidx-sp",
				ratings: JSON.stringify({ ktLampRating: 0 }),
				classes: JSON.stringify({}),
			})
			.execute();

		await expect(ParseImportClass(userId, "iidx-sp", {}, log)).rejects.toThrow(
			ScoreImportFatalError,
		);
	});
});
