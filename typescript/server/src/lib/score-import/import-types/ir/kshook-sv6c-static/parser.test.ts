/* eslint-disable @typescript-eslint/no-explicit-any */
import { log } from "#lib/log/log";
import { TestingKsHookSV6CStaticScore } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import { ParseKsHookSV6CStatic } from "./parser";

describe("ParseKsHookSV6CStatic", () => {
	const assertFail = (data: any) => {
		expect(() => ParseKsHookSV6CStatic(data, log)).toThrow();
	};

	const assertSuccess = (data: any) => {
		expect(() => ParseKsHookSV6CStatic(data, log)).not.toThrow();
		const res = ParseKsHookSV6CStatic(data, log);
		expect(res.gameGroup).toBe("sdvx");
		expect(Array.isArray(res.iterable)).toBe(true);
	};

	const dm = (data: any) => ({ scores: [deepmerge(TestingKsHookSV6CStaticScore, data)] });

	it("parses static KsHook payloads", () => {
		assertSuccess({ scores: [TestingKsHookSV6CStaticScore] });
		assertSuccess(dm({ unexpectedField: "foo" }));

		assertFail({});
		assertFail({ scores: TestingKsHookSV6CStaticScore });
		assertFail(dm({ clear: "invalid_clear" }));
		assertFail(dm({ difficulty: "invalid_difficulty" }));

		assertFail(dm({ grade: "invalid_grade" }));

		assertFail(dm({ max_chain: -1 }));
		assertFail(dm({ max_chain: 100.5 }));

		assertFail(dm({ score: -1 }));
		assertFail(dm({ score: 10_000_001 }));
		assertSuccess(dm({ score: 10_000_000 }));
		assertSuccess(dm({ score: 0 }));

		assertSuccess({
			scores: [TestingKsHookSV6CStaticScore, TestingKsHookSV6CStaticScore],
		});
	});
});
