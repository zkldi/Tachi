import { describe, expect, it } from "vitest";

import * as tachiCommon from "./index";

// we just check that we're exporting stuff properly
describe("Property Checks", () => {
	it("exports core APIs and constants", () => {
		expect(typeof tachiCommon.GetGameGroupConfig).toBe("function");
		expect(typeof tachiCommon.COLOUR_SET).toBe("object");
	});
});
