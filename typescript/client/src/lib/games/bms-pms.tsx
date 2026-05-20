import BMSOrPMSLampCell from "#components/tables/cells/BMSOrPMSLampCell";
import DeltaCell from "#components/tables/cells/DeltaCell";
import RatingCell from "#components/tables/cells/RatingCell";
import ScoreCell from "#components/tables/cells/ScoreCell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GPTClientImplementation } from "#lib/types";
import { IsNullish } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import React from "react";
import { COLOUR_SET, type GamesForGroup, IIDXLIKE_GBOUNDARIES } from "tachi-common";
import { FormatSieglindeBMS } from "tachi-common/config/game-support/bms";

import { bgc, CreateRatingSys } from "./_util";

const BASE_IMPL: GPTClientImplementation<GamesForGroup["bms" | "pms"]> = {
	sessionImportantScoreCount: 20,
	reverseFolderOrder: true,
	difficultyColours: {
		CHART: COLOUR_SET.gray, // lol
	},
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	enumColours: {
		grade: {
			F: COLOUR_SET.gray,
			E: COLOUR_SET.red,
			D: COLOUR_SET.maroon,
			C: COLOUR_SET.purple,
			B: COLOUR_SET.paleBlue,
			A: COLOUR_SET.green,
			AA: COLOUR_SET.blue,
			AAA: COLOUR_SET.gold,
			"MAX-": COLOUR_SET.teal,
			MAX: COLOUR_SET.white,
		},
		lamp: {
			"NO PLAY": COLOUR_SET.gray,
			FAILED: COLOUR_SET.red,
			"ASSIST CLEAR": COLOUR_SET.purple,
			"EASY CLEAR": COLOUR_SET.green,
			CLEAR: COLOUR_SET.blue,
			"HARD CLEAR": COLOUR_SET.orange,
			"EX HARD CLEAR": COLOUR_SET.gold,
			"FULL COMBO": COLOUR_SET.teal,
		},
	},
	classColours: {},
	ratingSystems: [
		CreateRatingSys(
			"Sieglinde EC",
			"TODO lol",
			"lamp",
			(c) => c.data.sglEC,
			(c) => (IsNullish(c.data.sglEC) ? null : FormatSieglindeBMS(c.data.sglEC!)),
		),
		CreateRatingSys(
			"Sieglinde HC",
			"TODO lol",
			"lamp",
			(c) => c.data.sglHC,
			(c) => (IsNullish(c.data.sglHC) ? null : FormatSieglindeBMS(c.data.sglHC!)),
		),
	],
	scoreHeaders: [
		["Score", "Score", NumericSOV((x) => x.scoreData.percent)],
		["Deltas", "Deltas", NumericSOV((x) => x.scoreData.percent)],
		["Lamp", "Lamp", NumericSOV((x) => x.scoreData.enumIndexes.lamp)],
	],
	scoreCoreCells: ({ sc }) => (
		<>
			<ScoreCell
				colour={GetEnumColour(sc, "grade")}
				grade={sc.scoreData.grade}
				percent={sc.scoreData.percent}
				score={sc.scoreData.score}
			/>
			<DeltaCell
				formatNumFn={(deltaPercent) => {
					const max = Math.floor(sc.scoreData.score / (sc.scoreData.percent / 100));

					const v = (deltaPercent / 100) * max;

					// i don't know if this is correct
					// it's just really hard to work out.
					return Math.round(v).toFixed(0);
				}}
				grade={sc.scoreData.grade}
				gradeBoundaries={IIDXLIKE_GBOUNDARIES}
				value={sc.scoreData.percent}
			/>
			<BMSOrPMSLampCell score={sc} />
		</>
	),
	ratingCell: ({ sc, rating }) => <RatingCell rating={rating} score={sc} />,
};

export const BMS_7K_IMPL: GPTClientImplementation<"bms-7k"> = {
	...BASE_IMPL,
	classColours: {
		genocideDan: {
			NORMAL_1: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_2: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_3: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_4: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_5: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_6: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_7: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_8: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_9: bgc("tomato", "var(--bs-dark)"),
			NORMAL_10: bgc("tomato", "var(--bs-dark)"),
			INSANE_1: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_2: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_3: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_4: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_5: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_6: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_7: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_8: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_9: bgc("var(--bs-danger)", "var(--bs-light)"),
			INSANE_10: bgc("var(--bs-danger)", "var(--bs-light)"),
			INSANE_KAIDEN: bgc("teal", "var(--bs-light)"),
			OVERJOY: bgc("purple", "var(--bs-light)"),
		},
		newGenerationDan: {
			NORMAL_1: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_2: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_3: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_4: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_5: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_6: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_7: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_8: bgc("lightblue", "var(--bs-dark)"),
			NORMAL_9: bgc("tomato", "var(--bs-dark)"),
			NORMAL_10: bgc("tomato", "var(--bs-dark)"),
			INSANE_0: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_1: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_2: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_3: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_4: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_5: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_6: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_7: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_8: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_9: bgc("var(--bs-danger)", "var(--bs-light)"),
			INSANE_10: bgc("var(--bs-danger)", "var(--bs-light)"),
			INSANE_KAIDEN: bgc("teal", "var(--bs-light)"),
		},
		lnDan: {
			DAN_1: bgc("lightblue", "var(--bs-dark)"),
			DAN_2: bgc("lightblue", "var(--bs-dark)"),
			DAN_3: bgc("lightblue", "var(--bs-dark)"),
			DAN_4: bgc("lightblue", "var(--bs-dark)"),
			DAN_5: bgc("lightblue", "var(--bs-dark)"),
			DAN_6: bgc("lightblue", "var(--bs-dark)"),
			DAN_7: bgc("lightblue", "var(--bs-dark)"),
			DAN_8: bgc("lightblue", "var(--bs-dark)"),
			DAN_9: bgc("tomato", "var(--bs-dark)"),
			DAN_10: bgc("tomato", "var(--bs-dark)"),
			KAIDEN: bgc("teal", "var(--bs-light)"),
			OVERJOY: bgc("purple", "var(--bs-light)"),
			UDON: bgc("gold", "var(--bs-dark)"),
		},
		scratchDan: {
			KYU_7: bgc("green", "var(--bs-light)"),
			KYU_6: bgc("green", "var(--bs-light)"),
			KYU_5: bgc("green", "var(--bs-light)"),
			KYU_4: bgc("green", "var(--bs-light)"),
			KYU_3: bgc("green", "var(--bs-light)"),
			KYU_2: bgc("green", "var(--bs-light)"),
			KYU_1: bgc("green", "var(--bs-light)"),
			DAN_1: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_2: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_3: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_4: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_5: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_6: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_7: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_8: bgc("var(--bs-info)", "var(--bs-light)"),
			DAN_9: bgc("var(--bs-danger)", "var(--bs-light)"),
			DAN_10: bgc("var(--bs-danger)", "var(--bs-light)"),
			KAIDEN: bgc("var(--bs-warning)", "var(--bs-dark)"),
		},
		stslDan: {
			SL0: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL1: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL2: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL3: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL4: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL5: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL6: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL7: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL8: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL9: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL10: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL11: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL12: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST0: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST1: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST2: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST3: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST4: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST5: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST6: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST7: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST8: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST9: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST10: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST11: bgc("var(--bs-dark)", "var(--bs-light)"),
			ST12: bgc("var(--bs-dark)", "var(--bs-light)"),
		},
	},
};

export const BMS_14K_IMPL: GPTClientImplementation<"bms-14k"> = {
	...BASE_IMPL,
	classColours: {
		genocideDan: BMS_7K_IMPL.classColours.genocideDan,
		stslDan: {
			SL0: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL1: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL2: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL3: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL4: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL5: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL6: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL7: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL8: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL9: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL10: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL11: bgc("var(--bs-dark)", "var(--bs-light)"),
			SL12: bgc("var(--bs-dark)", "var(--bs-light)"),
		},
	},
};

export const PMS_IMPL: GPTClientImplementation<GamesForGroup["pms"]> = {
	...BASE_IMPL,
	classColours: {
		dan: {
			INSANE_1: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_2: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_3: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_4: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_5: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_6: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_7: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_8: bgc("var(--bs-info)", "var(--bs-light)"),
			INSANE_9: bgc("red", "var(--bs-light)"),
			INSANE_10: bgc("red", "var(--bs-light)"),
			INSANE_KAIDEN: bgc("teal", "var(--bs-light)"),
			OVERJOY: bgc("purple", "var(--bs-light)"),
			UNDEFINED: bgc("var(--bs-warning)", "var(--bs-dark)"),
		},
	},
};
