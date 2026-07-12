/* eslint-disable @typescript-eslint/no-explicit-any */
import { log } from "#lib/log/log";
import { TestingKsHookSV6CScore } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import { ParseKsHookSV6C } from "./parser";

describe("ParseKsHookSV6C", () => {
	const assertFail = (data: any) => {
		expect(() => ParseKsHookSV6C(data, log)).toThrow();
	};

	const assertSuccess = (data: any) => {
		expect(() => ParseKsHookSV6C(data, log)).not.toThrow();
		const res = ParseKsHookSV6C(data, log);
		expect(res.gameGroup).toBe("sdvx");
		expect(typeof res.context.timeReceived).toBe("number");
		expect(Array.isArray(res.iterable)).toBe(true);
	};

	const dm = (data: any) => deepmerge(TestingKsHookSV6CScore, data);

	it("parses valid KsHook payloads and rejects invalid ones", () => {
		assertSuccess(TestingKsHookSV6CScore);
		assertSuccess(dm({ unexpectedField: "foo" }));

		assertFail({});
		assertFail(dm({ clear: "invalid_clear" }));
		assertFail(dm({ difficulty: "invalid_difficulty" }));

		assertFail(dm({ gauge: -1 }));
		assertFail(dm({ gauge: 10001 }));
		assertSuccess(dm({ gauge: 0 }));
		assertSuccess(dm({ gauge: 10000 }));

		assertFail(dm({ grade: "invalid_grade" }));

		assertFail(dm({ max_chain: -1 }));
		assertFail(dm({ max_chain: 100.5 }));

		assertFail(dm({ score: -1 }));
		assertFail(dm({ score: 10_000_001 }));
		assertSuccess(dm({ score: 10_000_000 }));
		assertSuccess(dm({ score: 0 }));

		assertFail(dm({ rate: "invalid_rate" }));

		assertFail(dm({ track_no: -1 }));
		assertFail(dm({ track_no: 50.5 }));
	});
});
