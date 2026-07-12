import { log } from "#lib/log/log";
import { TestingIIDXEamusementCSV27 } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { NaiveCSVParse } from "./naive-csv-parser";

describe("NaiveCSVParse", () => {
	it("parses valid basic CSV", () => {
		const headers = ["header1", "header2", "header3"];
		const rows = [
			["a", "b", "c"],
			["d", "e", "f"],
		];

		const headersStr = headers.join(",");
		const rowsStr = rows.map((r) => r.join(",")).join("\n");

		const csvBuffer = Buffer.from(`${headersStr}\n${rowsStr}`);

		const { rawHeaders, rawRows } = NaiveCSVParse(csvBuffer, log);

		expect(rawHeaders).toEqual(headers);
		expect(rawRows).toEqual(rows);
	});

	it("parses valid evil CSV (quotes, unicode)", () => {
		const headers = ["header1", '"header2"', 'hea"der3'];
		const rows = [
			["a ", "bbbbbbbbbbbbbbbbbbbbbbbbbbb", ""],
			["d", '"', "冥"],
		];

		const headersStr = headers.join(",");
		const rowsStr = rows.map((r) => r.join(",")).join("\n");

		const csvBuffer = Buffer.from(`${headersStr}\n${rowsStr}\n`);

		const { rawHeaders, rawRows } = NaiveCSVParse(csvBuffer, log);

		expect(rawHeaders).toEqual(headers);
		expect(rawRows).toEqual(rows);
	});

	it("parses IIDX e-amusement CSV fixture", () => {
		const { rawHeaders, rawRows } = NaiveCSVParse(TestingIIDXEamusementCSV27, log);

		expect(rawHeaders.length).toBe(41);
		expect(rawRows.length).toBe(1257);

		expect(rawRows.every((e) => e.length === 41)).toBe(true);
	});

	it("rejects rows with wrong cell counts vs headers", () => {
		const headerStr = `${"a,".repeat(26)}a`;

		const tooShort = Buffer.from(`${headerStr}\n${"a,".repeat(3)}a`);

		expect(() => NaiveCSVParse(tooShort, log)).toThrow(
			"Row 1 has an invalid amount of cells (4, expected 27)",
		);

		const tooLong = Buffer.from(`${headerStr}\n${"a,".repeat(50)}a`);

		expect(() => NaiveCSVParse(tooLong, log)).toThrow(
			"Row 1 has an invalid amount of cells (51, expected 27)",
		);
	});

	it("rejects misshaped headers", () => {
		const longHeaders = Buffer.from(`${"a".repeat(1000)},a`);

		expect(() => NaiveCSVParse(longHeaders, log)).toThrow(
			"Headers were longer than 1000 characters long.",
		);

		const tooManyHeaders = Buffer.from(`${"a,".repeat(50)}a`);

		expect(() => NaiveCSVParse(tooManyHeaders, log)).toThrow("Too many CSV headers.");
	});
});
