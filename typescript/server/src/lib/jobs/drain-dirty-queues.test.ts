import { describe, expect, it } from "vitest";

import { drainUntilIdleOrCap } from "./drain-dirty-queues";

describe("drainUntilIdleOrCap", () => {
	it("stops when the queue reports empty before the cap is reached", async () => {
		const batches = [3, 2, 0, 5];
		let calls = 0;

		const result = await drainUntilIdleOrCap(async () => {
			calls += 1;
			return batches.shift() ?? 0;
		}, 10);

		expect(result).toEqual({ capped: false, processed: 5 });
		expect(calls).toBe(3);
	});

	it("stops at the cap without requiring a final empty probe", async () => {
		let calls = 0;

		const result = await drainUntilIdleOrCap(async () => {
			calls += 1;
			return 5;
		}, 10);

		expect(result).toEqual({ capped: true, processed: 10 });
		expect(calls).toBe(2);
	});
});
