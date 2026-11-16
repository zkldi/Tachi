import { describe, expect, it } from "vitest";

import { NormalizeTableSlug } from "./table-slug";

describe("NormalizeTableSlug", () => {
	it.each([
		["sgl-EC", "sgl-ec"],
		["brightMemory3Omni-levels", "brightmemory3omni-levels"],
		["1.5-b-levels", "1-5-b-levels"],
		["  Mate / Levels  ", "mate-levels"],
		["mate-intl-levels", "mate-intl-levels"],
	])("normalizes %s to %s", (input, expected) => {
		expect(NormalizeTableSlug(input)).toBe(expected);
	});
});
