import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	CreateChartID,
	CreateFolderID,
	CreateQuestID,
	CreateSongID,
	CreateTableID,
	tachiID,
} from "./tachi-id";

describe("tachi-id", () => {
	beforeEach(() => {
		let i = 0;
		const bytes = [0xab, 0xcd, 0xef, 0x10];

		vi.stubGlobal("crypto", {
			getRandomValues(arr: Uint8Array) {
				for (let j = 0; j < arr.length; j++) {
					arr[j] = bytes[i++ % bytes.length]!;
				}

				return arr;
			},
		} as Crypto);
	});

	it("tachiID concatenates prefix, hex time delta, and 8 hex chars", () => {
		expect(tachiID("X", 4096, 0)).toBe("X1000abcdef10");
	});

	it("Create* helpers use expected prefixes", () => {
		expect(CreateChartID(1)).toMatch(/^C1[0-9a-f]{8}$/u);
		expect(CreateQuestID(1)).toMatch(/^Q1[0-9a-f]{8}$/u);
		expect(CreateSongID(1)).toMatch(/^S1[0-9a-f]{8}$/u);
		expect(CreateFolderID(1)).toMatch(/^F1[0-9a-f]{8}$/u);
		expect(CreateTableID(1)).toMatch(/^T1[0-9a-f]{8}$/u);
	});
});
