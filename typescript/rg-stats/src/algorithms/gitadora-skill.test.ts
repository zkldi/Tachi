import { test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";
import { calculate, inverse } from "./gitadora-skill";

test("GITADORA Skill Tests", () => {
	function MakeTestCase(scorePercent: number, level: number, expectedSkill: number): TestCase {
		return () =>
			isAprx(
				calculate(scorePercent, level),
				expectedSkill,
				`A Score Percent of ${scorePercent} on a chart with level ${level} should be worth ${expectedSkill} skill.`,
			);
	}

	const testCases = [
		MakeTestCase(89.48, 3.4, 60.84),
		MakeTestCase(70.76, 5.8, 82.08),
		MakeTestCase(40.2, 9.5, 76.38),

		MakeTestCase(97.8, 1, 19.56),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("GITADORA Skill Validation Tests", () => {
	expectThrowsSnapshot(() => calculate(-1, 1), "Should throw if skill provided was negative");
	expectThrowsSnapshot(() => calculate(50, -1), "Should throw if level provided was negative");
});

test("GITADORA Inverse Skill Tests", () => {
	function MakeTestCase(expectedPercent: number, level: number, skill: number): TestCase {
		return () =>
			isAprx(
				inverse(skill, level),
				expectedPercent,
				`A Skill Level of ${skill} on a chart with level ${level} should invert to ${expectedPercent} percent.`,
			);
	}

	const testCases = [
		MakeTestCase(89.48, 3.4, 60.84),
		MakeTestCase(70.76, 5.8, 82.08),
		MakeTestCase(40.2, 9.5, 76.38),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("GITADORA Inverse Skill Validation Tests", () => {
	expectThrowsSnapshot(
		() => inverse(9_000, 1),
		"Should throw if the skill provided was not possible on this chart.",
	);

	expectThrowsSnapshot(() => inverse(-1, 1), "Should throw if skill provided was negative");
	expectThrowsSnapshot(() => inverse(50, -1), "Should throw if level provided was negative");
});
