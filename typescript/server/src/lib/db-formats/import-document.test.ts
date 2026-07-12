import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { LoadImportDocumentById } from "./import-document";

describe("LoadImportDocumentById", () => {
	it("returns undefined when import does not exist", async () => {
		const doc = await LoadImportDocumentById("nonexistent-import-id");

		expect(doc).toBeUndefined();
	});

	it("composes an ImportDocument from Postgres rows", async () => {
		const { id: userId } = await seedUser();
		const importId = `import-fmt-${Date.now()}`;
		const now = new Date().toISOString();

		await DB.insertInto("import")
			.values({
				id: importId,
				user_id: userId,
				time_started: now,
				time_finished: now,
				game_group: "iidx",
				import_type: "ir/direct-manual",
				user_intent: true,
				service: "test-svc",
				status: "completed",
			})
			.execute();

		await DB.insertInto("import_game").values({ id: importId, game: "iidx-sp" }).execute();

		await DB.insertInto("import_error")
			.values({ import_id: importId, type: "T", message: "m" })
			.execute();

		const doc = await LoadImportDocumentById(importId);

		expect(doc).toMatchObject({
			importID: importId,
			userID: userId,
			gameGroup: "iidx",
			games: ["iidx-sp"],
			importType: "ir/direct-manual",
			userIntent: true,
			errors: [{ type: "T", message: "m" }],
			goalInfo: [],
			questInfo: [],
		});
	});
});
