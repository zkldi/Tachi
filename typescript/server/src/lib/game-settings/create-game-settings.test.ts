import { describe, expect, it } from "vitest";

import { newGameProfilePreferenceColumns } from "./create-game-settings";

describe("newGameProfilePreferenceColumns", () => {
	it("returns IIDX-specific defaults for iidx-sp", () => {
		const cols = newGameProfilePreferenceColumns("iidx-sp");
		expect(JSON.parse(cols.data)).toEqual({ display2DXTra: false, bpiTarget: 0 });
		expect(JSON.parse(cols.showcase)).toEqual([]);
		expect(cols.pf_preferred_score_alg).toBeNull();
	});

	it("returns empty gameSpecific JSON for non-IIDX games", () => {
		const cols = newGameProfilePreferenceColumns("bms-7k");
		expect(JSON.parse(cols.data)).toEqual({});
		expect(JSON.parse(cols.showcase)).toEqual([]);
	});
});
