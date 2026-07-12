import { describe, expect, it } from "vitest";

import { HashSHA256 } from "./crypto";

describe("HashSHA256", () => {
	it("hashes 'something' to the expected SHA-256 hex digest", () => {
		expect(HashSHA256(Buffer.from("something"))).toBe(
			"3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb",
		);
	});
});
