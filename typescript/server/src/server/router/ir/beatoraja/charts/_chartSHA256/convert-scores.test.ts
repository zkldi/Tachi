import type { PBScoreDocument } from "tachi-common";

import { dmf } from "#test-utils/misc";
import { BMSGazerChart } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { TachiScoreDataToBeatorajaFormat } from "./convert-scores";

const pbScore = {
	composedFrom: [{ name: "Best Score", scoreID: "mock_lampPB" }],
	scoreData: {
		enumIndexes: {
			lamp: 4,
		},
		score: 1234,
		optional: {},
	},
	scoreMeta: {},
	chartID: BMSGazerChart.chartID,
	userID: 1,
	game: "bms-7k",
} as unknown as PBScoreDocument<"bms-7k">;

describe("TachiScoreDataToBeatorajaFormat (ported from convert-scores.oldtest.ts)", () => {
	it("converts score to Beatoraja format", () => {
		const res = TachiScoreDataToBeatorajaFormat(
			pbScore,
			BMSGazerChart.data.hashSHA256,
			"",
			BMSGazerChart.data.notecount,
			0,
		);

		expect(res).toEqual({
			sha256: "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d",
			player: "",
			playcount: 0,
			clear: 5,
			date: 0,
			maxcombo: 0,
			deviceType: null,
			gauge: 0,
			random: null,
			passnotes: 0,
			minbp: 0,
			notes: 2256,
			epg: 617,
			lpg: 0,
			egr: 0,
			lgr: 0,
			egd: 0,
			lgd: 0,
			ebd: 0,
			lbd: 0,
			epr: 0,
			lpr: 0,
			ems: 0,
			lms: 0,
		});
	});

	it("fakes epg/egr when score metrics are missing", () => {
		const res = TachiScoreDataToBeatorajaFormat(
			dmf(pbScore, { scoreData: { ...pbScore.scoreData, score: 999 } } as never),
			BMSGazerChart.data.hashSHA256,
			"",
			BMSGazerChart.data.notecount,
			0,
		);

		expect(res).toEqual({
			sha256: "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d",
			player: "",
			playcount: 0,
			clear: 5,
			date: 0,
			maxcombo: 0,
			deviceType: null,
			gauge: 0,
			random: null,
			passnotes: 0,
			minbp: 0,
			notes: 2256,
			epg: Math.floor(999 / 2),
			lpg: 0,
			egr: 1,
			lgr: 0,
			egd: 0,
			lgd: 0,
			ebd: 0,
			lbd: 0,
			epr: 0,
			lpr: 0,
			ems: 0,
			lms: 0,
		});
	});

	it("sets player name when provided", () => {
		const res = TachiScoreDataToBeatorajaFormat(
			pbScore,
			BMSGazerChart.data.hashSHA256,
			"test_zkldi",
			BMSGazerChart.data.notecount,
			0,
		);

		expect(res.player).toBe("test_zkldi");
		expect(res.epg).toBe(617);
	});

	it("sets metadata when supplied", () => {
		const res = TachiScoreDataToBeatorajaFormat(
			pbScore,
			BMSGazerChart.data.hashSHA256,
			"test_zkldi",
			BMSGazerChart.data.notecount,
			3,
			{ inputDevice: "BM_CONTROLLER", random: "MIRROR" },
		);

		expect(res.deviceType).toBe("BM_CONTROLLER");
		expect(res.random).toBe(1);
		expect(res.playcount).toBe(3);
	});
});
