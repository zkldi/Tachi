import { expect, test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { calculateFromBPMPerMeasure } from "./itg-highest-unbroken";
import { RepeatNTimes } from "../util/misc";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";

test("ITG Highest Unbroken Tests", () => {
	function MakeTestCase(
		expected32: number | null,
		bpmPerMeasure: Array<number>,
		notesPerMeasure: Array<number>,
		diedAt?: number | null,
		measures?: number,
	): TestCase {
		return () => {
			const value = calculateFromBPMPerMeasure(
				bpmPerMeasure,
				notesPerMeasure,
				diedAt,
				measures,
			);

			const msg = `A breakdown of ${bpmPerMeasure.join(", ")} should result in a highest ${
				measures ?? 32
			} of ${expected32}`;

			if (expected32 === null || value === null) {
				return expect(value, msg).toBe(expected32);
			} else {
				return isAprx(value, expected32, msg);
			}
		};
	}

	const testCases = [
		MakeTestCase(null, [], []),
		MakeTestCase(190, [50, 50, 50, ...RepeatNTimes(190, 32)], RepeatNTimes(16, 32 + 3)),
		MakeTestCase(
			340,
			[50, 50, 50, ...RepeatNTimes(340, 16)],
			[16, 16, 16, ...RepeatNTimes(32, 16)],
		),

		MakeTestCase(null, [50, 50, 50, ...RepeatNTimes(190, 32)], RepeatNTimes(16, 32 + 3), 1),

		MakeTestCase(50, [50, 50, 50, ...RepeatNTimes(190, 32)], RepeatNTimes(16, 32 + 3), 32),

		MakeTestCase(
			200,

			RepeatNTimes(200, 21),

			[RepeatNTimes(16, 12), RepeatNTimes(32, 6), RepeatNTimes(64, 3)].flat(),
		),

		MakeTestCase(
			null,
			[...RepeatNTimes(200, 31), ...RepeatNTimes(0, 1), ...RepeatNTimes(200, 31)],
			[...RepeatNTimes(16, 31), ...RepeatNTimes(0, 1), ...RepeatNTimes(16, 31)],
		),
		MakeTestCase(
			200,
			[...RepeatNTimes(200, 31), ...RepeatNTimes(0, 1), ...RepeatNTimes(200, 32)],
			[...RepeatNTimes(16, 31), ...RepeatNTimes(0, 1), ...RepeatNTimes(16, 32)],
		),

		MakeTestCase(200, RepeatNTimes(200, 1024), RepeatNTimes(16, 1024), null, 1024),
		MakeTestCase(null, RepeatNTimes(200, 1024), RepeatNTimes(16, 1024), null, 1025),

		MakeTestCase(200, RepeatNTimes(200, 2), RepeatNTimes(16, 2), null, 2),
		MakeTestCase(null, RepeatNTimes(200, 2), RepeatNTimes(16, 2), null, 3),
	];

	for (const testCase of testCases) {
		testCase();
	}

	expectThrowsSnapshot(
		() => calculateFromBPMPerMeasure([], [1]),
		"Should throw if bpms and notes don't have same length",
	);
	expectThrowsSnapshot(
		() => calculateFromBPMPerMeasure([], [], -1),
		"Should throw if died at is negative",
	);
	expectThrowsSnapshot(
		() => calculateFromBPMPerMeasure([], [], null, 0),
		"Should throw if measures is 0",
	);
	expectThrowsSnapshot(
		() => calculateFromBPMPerMeasure([], [], null, 1),
		"Should throw if measures is 1",
	);
	expectThrowsSnapshot(
		() => calculateFromBPMPerMeasure([], [], null, -1),
		"Should throw if measures is negative",
	);
});
