import { CronExpressionParser } from "cron-parser";
import { describe, expect, it } from "vitest";

import { getDueFireTime } from "./cron-service";

/** Slow reference: advance from `start` until the last fire still <= `now` (for tests only). */
function dueFireTimeForwardFrom(
	schedule: string,
	start: Date,
	now: Date,
	maxSteps: number,
): Date | null {
	const it = CronExpressionParser.parse(schedule, { currentDate: start });
	const first = it.next().toDate();
	if (first.getTime() > now.getTime()) {
		return null;
	}
	let lastDue = first;
	for (let i = 0; i < maxSteps; i++) {
		const n = it.next().toDate();
		if (n.getTime() > now.getTime()) {
			return lastDue;
		}
		lastDue = n;
	}
	throw new Error(`Exceeded ${maxSteps} steps (schedule ${schedule})`);
}

describe("getDueFireTime", () => {
	it("null last: minutely schedule uses bounded search and matches a short forward window", () => {
		const now = new Date("2026-05-17T18:45:30.123Z");
		const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
		const expected = dueFireTimeForwardFrom("* * * * *", from, now, 5000);
		expect(getDueFireTime("* * * * *", null, now)).toEqual(expected);
	});

	it("null last: exact minute boundary matches forward iteration (prev() must not skip the current tick)", () => {
		const now = new Date("2026-05-17T18:45:00.000Z");
		const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
		const expected = dueFireTimeForwardFrom("* * * * *", from, now, 5000);
		expect(getDueFireTime("* * * * *", null, now)).toEqual(expected);
	});

	it("null last: daily monthly and yearly examples match a bounded forward reference", () => {
		const specs: Array<{ daysBack: number; maxSteps: number; now: string; schedule: string }> =
			[
				{
					schedule: "5 0 * * *",
					now: "2026-05-17T18:45:30.000Z",
					maxSteps: 50,
					daysBack: 3,
				},
				{
					schedule: "0 0 * * *",
					now: "2026-05-17T18:45:30.000Z",
					maxSteps: 10,
					daysBack: 3,
				},
				{
					schedule: "0 0 1 * *",
					now: "2026-03-15T12:00:00.000Z",
					maxSteps: 40,
					daysBack: 60,
				},
				{
					schedule: "0 0 1 1 *",
					now: "2026-06-15T12:00:00.000Z",
					maxSteps: 10,
					daysBack: 400,
				},
			];
		for (const { schedule, now: nowIso, maxSteps, daysBack } of specs) {
			const now = new Date(nowIso);
			const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
			const expected = dueFireTimeForwardFrom(schedule, start, now, maxSteps);
			expect(getDueFireTime(schedule, null, now), schedule).toEqual(expected);
		}
	});

	it("non-null last: unchanged skip-missed semantics vs forward reference", () => {
		const now = new Date("2026-05-17T18:45:30.000Z");
		const last = new Date("2026-05-17T18:40:00.000Z");
		const expected = dueFireTimeForwardFrom(
			"* * * * *",
			new Date(last.getTime() + 1),
			now,
			200,
		);
		expect(getDueFireTime("* * * * *", last, now)).toEqual(expected);
	});

	it("non-null last: not due yet", () => {
		const now = new Date("2026-05-17T18:44:59.000Z");
		const last = new Date("2026-05-17T18:44:00.000Z");
		expect(getDueFireTime("* * * * *", last, now)).toBeNull();
	});
});
