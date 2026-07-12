import { expect, test } from "vitest";
import { TestCase } from "../test-utils/test-case";
import { ErrVars, ThrowIf } from "./throw-if";

type MockThrowFn<C> = (condition: C, errMsg: string, errVars: ErrVars) => void;

test("ThrowIf Tests", () => {
	function ShouldThrow<C>(throwIfFn: MockThrowFn<C>, condition: C): TestCase {
		return () => {
			expect(
				() => throwIfFn(condition, "Some Error Message.", { foo: 2, bar: "baz" }),
				`${throwIfFn.name} (cond:${condition}) Should throw an error with a pretty message.`,
			).toThrow(/^Invalid input, Some Error Message\. foo=2, bar="baz"\.$/u);
			expect(
				() => throwIfFn(condition, "Some Error Message", { foo: 2, bar: "baz" }),
				`${throwIfFn.name} (cond:${condition}) Should add a full stop after the error message if one was accidentally forgotten.`,
			).toThrow(/^Invalid input, Some Error Message\. foo=2, bar="baz"\.$/u);
		};
	}

	function ShouldNotThrow<C>(throwIfFn: MockThrowFn<C>, condition: C): TestCase {
		return () => {
			expect(
				() => throwIfFn(condition, "Some Error Message.", { foo: 2, bar: "baz" }),
				`${throwIfFn.name} (cond:${condition}) Should not throw an error.`,
			).not.toThrow();
		};
	}

	const testCases: TestCase[] = [
		ShouldThrow(ThrowIf, true),
		ShouldThrow(ThrowIf.not, false),
		ShouldThrow(ThrowIf.negative, -1),
		ShouldThrow(ThrowIf.positive, 1),
		ShouldThrow(ThrowIf.positiveOrZero, 1),
		ShouldThrow(ThrowIf.positiveOrZero, 0),
		ShouldThrow(ThrowIf.negativeOrZero, -1),
		ShouldThrow(ThrowIf.negativeOrZero, 0),
		ShouldThrow(ThrowIf.zero, 0),
		ShouldNotThrow(ThrowIf, false),
		ShouldNotThrow(ThrowIf.not, true),
		ShouldNotThrow(ThrowIf.positive, -1),
		ShouldNotThrow(ThrowIf.positive, 0),
		ShouldNotThrow(ThrowIf.negative, 1),
		ShouldNotThrow(ThrowIf.negative, 0),
		ShouldNotThrow(ThrowIf.positiveOrZero, -1),
		ShouldNotThrow(ThrowIf.negativeOrZero, 1),
		ShouldNotThrow(ThrowIf.zero, 1),
		ShouldNotThrow(ThrowIf.zero, -1),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("ThrowIf Formatting Edge Cases", () => {
	expect(
		() =>
			ThrowIf(true, "msg", {
				foo: "1",
				bar: 1,
			}),
		"Should differentiate strings from numbers.",
	).toThrow(/^Invalid input, msg\. foo="1", bar=1\.$/u);

	expect(
		() =>
			ThrowIf(true, "msg", {
				foo: "1, bar=1",
			}),
		"Should keep string values inside strings.",
	).toThrow(/^Invalid input, msg\. foo="1, bar=1"\.$/u);

	expect(
		() =>
			ThrowIf(true, "msg", {
				foo: '1", bar=1',
			}),
		"Should escape quotes to not allow breaking out.",
	).toThrow(/^Invalid input, msg\. foo="1\\", bar=1"\.$/u);
});
