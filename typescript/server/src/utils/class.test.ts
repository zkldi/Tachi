import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { UpdateClassIfGreater } from "./class";

function asClassesJson(v: unknown): { dan?: string } {
	if (typeof v === "string") {
		return JSON.parse(v) as { dan?: string };
	}

	return v as { dan?: string };
}

describe("UpdateClassIfGreater (Postgres)", () => {
	it("returns false when new class is not greater", async () => {
		const { id } = await seedUser({ username: `cls_down_${Date.now()}` });

		await DB.insertInto("game_profile")
			.values({
				classes: JSON.stringify({ dan: "DAN_1" }),
				game: "iidx-sp",
				ratings: JSON.stringify({}),
				user_id: id,
			})
			.execute();

		const result = await UpdateClassIfGreater(id, "iidx-sp", "dan", "KYU_7");
		expect(result).toBe(false);

		const row = await DB.selectFrom("game_profile")
			.select("classes")
			.where("user_id", "=", id)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		expect(asClassesJson(row.classes).dan).toBe("DAN_1");
	});

	it("returns true and updates when new class is greater", async () => {
		const { id } = await seedUser({ username: `cls_up_${Date.now()}` });

		await DB.insertInto("game_profile")
			.values({
				classes: JSON.stringify({ dan: "KYU_7" }),
				game: "iidx-sp",
				ratings: JSON.stringify({}),
				user_id: id,
			})
			.execute();

		const result = await UpdateClassIfGreater(id, "iidx-sp", "dan", "DAN_1");
		expect(result).toBe(true);

		const row = await DB.selectFrom("game_profile")
			.select("classes")
			.where("user_id", "=", id)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		expect(asClassesJson(row.classes).dan).toBe("DAN_1");

		const ach = await DB.selectFrom("class_achievement")
			.select(["class_prev_value", "class_value"])
			.where("user_id", "=", id)
			.where("game", "=", "iidx-sp")
			.orderBy("timestamp", "desc")
			.executeTakeFirstOrThrow();

		expect(ach.class_value).toBe("DAN_1");
		expect(ach.class_prev_value).toBe("KYU_7");
	});

	it("creates game_profile with preference defaults when none exist (first class)", async () => {
		const { id } = await seedUser({ username: `cls_new_${Date.now()}` });

		const result = await UpdateClassIfGreater(id, "iidx-sp", "dan", "DAN_1");
		expect(result).toBe(null);

		const profile = await DB.selectFrom("game_profile")
			.selectAll()
			.where("user_id", "=", id)
			.where("game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		expect(asClassesJson(profile.classes).dan).toBe("DAN_1");

		const dataRaw = profile.data;
		const data =
			typeof dataRaw === "string"
				? (JSON.parse(dataRaw) as { bpiTarget?: number; display2DXTra?: boolean })
				: (dataRaw as { bpiTarget?: number; display2DXTra?: boolean });
		expect(data.display2DXTra).toBe(false);
		expect(data.bpiTarget).toBe(0);
	});
});
