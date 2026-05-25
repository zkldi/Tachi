import { agta } from "#test-utils/misc";
import { describe, expect, it } from "vitest";

import { applyKaiTimestop } from "./kai-timestop";

function source(items: unknown[]) {
	return (async function* () {
		for (const item of items) {
			yield item;
		}
	})();
}

const T_OLD = "2024-01-01T00:00:00.000Z"; // 1704067200000
const T_NEW = "2025-01-01T00:00:00.000Z"; // 1735689600000
const CUTOFF = new Date("2024-06-01T00:00:00.000Z"); // between old and new

describe("applyKaiTimestop", () => {
	it("yields all items when lastScoreTime is null", async () => {
		const items = [{ timestamp: T_OLD }, { timestamp: T_NEW }, { other: "no timestamp" }];

		const result = await agta(applyKaiTimestop(source(items), null));

		expect(result).toStrictEqual(items);
	});

	it("yields items newer than the cutoff", async () => {
		const items = [{ timestamp: T_NEW }, { timestamp: T_NEW }];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual(items);
	});

	it("stops at the first item at or before the cutoff", async () => {
		const items = [
			{ timestamp: T_NEW },
			{ timestamp: T_OLD }, // <= cutoff → stop here
			{ timestamp: T_NEW }, // would have been yielded but we already stopped
		];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		// Only the first item (newer) should come through
		expect(result).toStrictEqual([{ timestamp: T_NEW }]);
	});

	it("stops immediately when the very first item is at or before the cutoff", async () => {
		const items = [{ timestamp: T_OLD }, { timestamp: T_NEW }];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual([]);
	});

	it("yields items with no timestamp field through without stopping", async () => {
		const items = [{ other: "field" }, { timestamp: T_NEW }];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual(items);
	});

	it("yields items with a non-string timestamp field through without stopping", async () => {
		const items = [{ timestamp: 12345 }, { timestamp: T_NEW }];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual(items);
	});

	it("yields items with an unparseable timestamp through without stopping", async () => {
		const items = [{ timestamp: "not-a-date" }, { timestamp: T_NEW }];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual(items);
	});

	it("stops on an item whose timestamp exactly equals the cutoff", async () => {
		const items = [
			{ timestamp: T_NEW },
			{ timestamp: CUTOFF.toISOString() }, // exactly at cutoff
		];

		const result = await agta(applyKaiTimestop(source(items), CUTOFF));

		expect(result).toStrictEqual([{ timestamp: T_NEW }]);
	});

	it("yields an empty source unchanged", async () => {
		const result = await agta(applyKaiTimestop(source([]), CUTOFF));

		expect(result).toStrictEqual([]);
	});
});
