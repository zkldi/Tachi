import { describe, expect, it } from "vitest";

import { FilterChartsAndSongs, GetScoreIDsFromComposed } from "./scores";

describe("FilterChartsAndSongs", () => {
	it("keeps only charts and songs referenced by scores", () => {
		const out = FilterChartsAndSongs(
			[{ chartID: "c1", songID: "s1" } as never, { chartID: "c2", songID: "s2" } as never],
			[{ chartID: "c1" } as never, { chartID: "cX" } as never],
			[{ id: "s1" } as never, { id: "s9" } as never],
		);

		expect(out.charts.map((c: { chartID: string }) => c.chartID)).toEqual(["c1"]);
		expect(out.songs.map((s: { id: string }) => s.id)).toEqual(["s1"]);
	});
});

describe("GetScoreIDsFromComposed", () => {
	it("dedupes score IDs from composedFrom", () => {
		const ids = GetScoreIDsFromComposed({
			composedFrom: [
				{ name: "Primary", scoreID: "a" },
				{ name: "M1", scoreID: "b" },
				{ name: "M2", scoreID: "a" },
			],
		} as never);

		expect(ids.sort()).toEqual(["a", "b"]);
	});
});
