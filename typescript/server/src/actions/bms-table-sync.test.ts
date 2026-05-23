import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { CreateChartID } from "tachi-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_BMSTableSync, extractBmstableRedirectTarget } from "./bms-table-sync";

const { testMd5, mockLoadBMSTable, fakeTable } = vi.hoisted(() => {
	const md5 = "c".repeat(32);
	const load = vi.fn();

	const table = {
		name: "TestTable",
		prefix: "★",
		asciiPrefix: "t",
		game: "bms-7k" as const,
		url: "https://test.invalid/bms-table-unit",
		description: "unit test",
	};

	return { testMd5: md5, mockLoadBMSTable: load, fakeTable: table };
});

vi.mock("bms-table-loader", () => ({
	LoadBMSTable: mockLoadBMSTable,
}));

vi.mock("tachi-common", async (importOriginal) => {
	const actual = await importOriginal<typeof import("tachi-common")>();
	return {
		...actual,
		BMS_TABLES: [fakeTable],
	};
});

describe("extractBmstableRedirectTarget", () => {
	it("resolves darksabun github.io migration stubs to darksabun.club", () => {
		const html = `<!doctype html>
<script>
  var newDomain = "https://darksabun.club";
  window.location.replace(newDomain + window.location.pathname);
</script>`;

		expect(
			extractBmstableRedirectTarget(
				"https://darksabun.github.io/table/archive/insane1/",
				html,
			),
		).toBe("https://darksabun.club/table/archive/insane1/");
	});

	it("preserves the source path for bare-domain meta refresh targets", () => {
		const html = '<meta http-equiv="refresh" content="0; url=https://darksabun.club" />';

		expect(
			extractBmstableRedirectTarget(
				"https://darksabun.github.io/table/archive/normal1/",
				html,
			),
		).toBe("https://darksabun.club/table/archive/normal1/");
	});

	it("follows absolute window.location.replace targets", () => {
		const html = `window.location.replace("https://example.com/table/header.json");`;

		expect(extractBmstableRedirectTarget("https://old.example/table/", html)).toBe(
			"https://example.com/table/header.json",
		);
	});
});

describe("ACTION_BMSTableSync", () => {
	const songNewID = "song-bms-action-test";
	const chartId = CreateChartID();
	const legacySongId = 884_001;
	let adminId: number;

	beforeEach(async () => {
		({ id: adminId } = await seedUser({ authLevel: "admin" }));

		mockLoadBMSTable.mockResolvedValue({
			head: { symbol: fakeTable.prefix },
			body: [
				{
					checksum: { type: "md5" as const, value: testMd5 },
					content: { title: "Unit", level: 9 },
				},
			],
		});
	});

	afterEach(async () => {
		await DB.deleteFrom("chart").where("id", "=", chartId).execute();
		await DB.deleteFrom("song").where("id", "=", songNewID).execute();
		await DB.deleteFrom("action").where("user_id", "=", adminId).execute();
		await DB.deleteFrom("account").where("id", "=", adminId).execute();
		mockLoadBMSTable.mockReset();
	});

	it("applies mocked table levels to an existing BMS chart and song (DefaultAdminUser taker)", async () => {
		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: legacySongId,
				game_group: "bms",
				title: "Unit Song",
				artist: "Unit",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: {
					subtitle: null,
					subartist: null,
					genre: null,
					tableString: null,
				},
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "bms-7k",
				song_id: songNewID,
				level: "?",
				level_num: 0,
				is_primary: true,
				difficulty: "CHART",
				versions: [],
				data: {
					hashMD5: testMd5,
					hashSHA256: "d".repeat(64),
					notecount: 1,
					tableFolders: {},
					aiLevel: null,
					sglEC: null,
					sglHC: null,
				},
			})
			.execute();

		const taker = await DefaultAdminUser.actionTaker();
		expect(taker.acct.id).toBe(adminId);

		await ACTION_BMSTableSync(taker, {});

		expect(mockLoadBMSTable).toHaveBeenCalledWith(fakeTable.url);

		const chartRow = await DB.selectFrom("chart")
			.select("data")
			.where("id", "=", chartId)
			.executeTakeFirstOrThrow();

		const folders = (chartRow.data as { tableFolders: Record<string, string> }).tableFolders;
		expect(folders["★"]).toBe("9");

		const songRow = await DB.selectFrom("song")
			.select("data")
			.where("id", "=", songNewID)
			.executeTakeFirstOrThrow();

		const ts = (songRow.data as { tableString: string | null }).tableString;
		expect(ts).toContain("★");
		expect(ts).toContain("9");
	});

	it("rejects non-admin takers", async () => {
		const { id: userId } = await seedUser({ authLevel: "user", username: "normie" });
		await expect(
			ACTION_BMSTableSync({ ip: "127.0.0.1", acct: { id: userId, username: "normie" } }, {}),
		).rejects.toThrow(/not authorized/u);
		await DB.deleteFrom("action").where("user_id", "=", userId).execute();
		await DB.deleteFrom("account").where("id", "=", userId).execute();
	});
});
