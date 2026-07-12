import { describe, expect, it } from "vitest";

import { SLASH_STRING_CHOICE_LIMIT, sortedSlashChoiceKeys } from "./slash-choice-limit";

describe("sortedSlashChoiceKeys", () => {
	it("sorts keys deterministically", () => {
		const { keysIncluded } = sortedSlashChoiceKeys(["z", "a", "m"]);
		expect(keysIncluded).toEqual(["a", "m", "z"]);
	});

	it("drops keys past the Discord choice limit alphabetically", () => {
		const labels = Array.from({ length: 30 }, (_, i) => `key-${String(i).padStart(2, "0")}`);
		const { keysIncluded, keysOmitted } = sortedSlashChoiceKeys(
			labels,
			SLASH_STRING_CHOICE_LIMIT,
		);

		expect(keysIncluded).toHaveLength(SLASH_STRING_CHOICE_LIMIT);
		expect(keysOmitted).toHaveLength(5);
		expect(keysIncluded[0]).toBe("key-00");
		expect(keysOmitted[0]).toBe("key-25");
	});
});
