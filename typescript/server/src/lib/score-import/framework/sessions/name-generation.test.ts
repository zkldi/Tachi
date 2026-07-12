import { describe, expect, it } from "vitest";

import { GenerateRandomSessionName } from "./name-generation";

describe("GenerateRandomSessionName", () => {
	it("returns a string", () => {
		const res = GenerateRandomSessionName();

		expect(typeof res).toBe("string");
	});
});
