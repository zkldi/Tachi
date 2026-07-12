/* eslint-disable @typescript-eslint/no-explicit-any */
import { log } from "#lib/log/log";
import { TestingLR2HookScore } from "#test-utils/test-data";
import { ApplyNTimes } from "#utils/misc";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import { ParseLR2Hook } from "./parser";

describe("ParseLR2Hook", () => {
	const assertFail = (data: any) => {
		expect(() => ParseLR2Hook(data, log)).toThrow();
	};

	const assertSuccess = (data: any) => {
		expect(() => ParseLR2Hook(data, log)).not.toThrow();
		const res = ParseLR2Hook(data, log);
		expect(res.gameGroup).toBe("bms");
		expect(typeof res.context.timeReceived).toBe("number");
		expect(Array.isArray(res.iterable)).toBe(true);
		expect(res.classProvider).toBeNull();
	};

	const dm = (data: any) => deepmerge(TestingLR2HookScore, data);
	const dms = (data: any) =>
		deepmerge(
			TestingLR2HookScore,
			{ scoreData: data },
			{
				arrayMerge: (_a, b) => b,
			},
		);
	const dmse = (data: any) =>
		deepmerge(
			deepmerge(TestingLR2HookScore, {
				scoreData: {
					extendedJudgements: {
						epg: 0,
						lpg: 0,
						egr: 0,
						lgr: 0,
						egd: 0,
						lgd: 0,
						ebd: 0,
						lbd: 0,
						epr: 0,
						lpr: 0,
						cb: 0,
						fast: 0,
						slow: 0,
						notesPlayed: 0,
					},
				},
			}),
			{ scoreData: data },
			{
				arrayMerge: (_a, b) => b,
			},
		);

	it("parses valid scores and rejects invalid payloads", () => {
		assertSuccess(TestingLR2HookScore);
		assertSuccess(dm({ unexpectedField: "foo" }));
		assertSuccess(dm({ scoreData: { unexpectedField: "foo" } }));
		assertSuccess(dm({ playerData: { unexpectedField: "foo" } }));

		assertFail(dm({ playerData: { autoScr: true } }));
		assertFail(dm({ playerData: { random: "H-RAN" } }));
		assertFail(dm({ playerData: { random: "ALLSCR" } }));

		assertFail({});

		assertFail(dm({ playerData: { rseed: "0" } }));
		assertFail(dm({ playerData: { rseed: 0.5 } }));

		assertFail(dm({ unixTimestamp: "foo" }));
		assertFail(dm({ unixTimestamp: 0.5 }));

		for (const key of [
			"pgreat",
			"good",
			"bad",
			"poor",
			"great",
			"maxCombo",
			"exScore",
			"notesTotal",
			"notesPlayed",
		]) {
			assertFail(dms({ [key]: -1 }));
			assertFail(dms({ [key]: 0.5 }));
			assertFail(dms({ [key]: "0" }));
			assertFail(dms({ [key]: null }));
		}

		assertFail(dms({ lamp: "UNKNOWN_LAMP" }));
		assertFail(dms({ lamp: null }));
		assertFail(dms({ lamp: undefined }));

		for (const key of [
			"epg",
			"lpg",
			"egr",
			"lgr",
			"egd",
			"lgd",
			"ebd",
			"lbd",
			"epr",
			"lpr",
			"cb",
			"fast",
			"slow",
			"notesPlayed",
		]) {
			assertFail(dmse({ extendedJudgements: { [key]: -1 } }));
			assertFail(dmse({ extendedJudgements: { [key]: 0.5 } }));
			assertFail(dmse({ extendedJudgements: { [key]: "0" } }));
			assertFail(dmse({ extendedJudgements: { [key]: null } }));
		}

		assertFail(dms({ hpGraph: ApplyNTimes(999, () => 50) }));
		assertFail(dms({ hpGraph: [] }));
		assertFail(dms({ hpGraph: ApplyNTimes(1001, () => 50) }));
		assertFail(dms({ hpGraph: ApplyNTimes(1000, () => 101) }));
		assertFail(dms({ hpGraph: ApplyNTimes(1000, () => -1) }));

		assertFail(
			dms({
				extendedHpGraphs: {
					groove: [],
					hard: ApplyNTimes(1000, () => 100),
					hazard: ApplyNTimes(1000, () => 100),
					easy: ApplyNTimes(1000, () => 100),
					pattack: ApplyNTimes(1000, () => 100),
					gattack: ApplyNTimes(1000, () => 100),
				},
			}),
		);
	});
});
