import MillionsScoreCell from "#components/tables/cells/MillionsScoreCell";
import SDVXJudgementCell from "#components/tables/cells/SDVXJudgementCell";
import SDVXLampCell from "#components/tables/cells/SDVXLampCell";
import VF6Cell from "#components/tables/cells/VF6Cell";
import VF7Cell from "#components/tables/cells/VF7Cell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GPTClientImplementation } from "#lib/types";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatMillions } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import React from "react";
import { COLOUR_SET, type GamesForGroup, SDVX_GRADES, SDVX_LAMPS } from "tachi-common";

import { bgc, CreateRatingSys } from "./_util";

type SDVXLikes = GamesForGroup["sdvx" | "usc"];

const SDVXLIKE_ENUM_COLOURS: GPTClientImplementation<SDVXLikes>["enumColours"] = {
	grade: {
		D: COLOUR_SET.gray,
		C: COLOUR_SET.red,
		B: COLOUR_SET.maroon,
		A: COLOUR_SET.paleBlue,
		"A+": COLOUR_SET.blue,
		AA: COLOUR_SET.paleGreen,
		"AA+": COLOUR_SET.green,
		AAA: COLOUR_SET.gold,
		"AAA+": COLOUR_SET.vibrantOrange,
		S: COLOUR_SET.teal,
		PUC: COLOUR_SET.pink,
	},
	lamp: {
		FAILED: COLOUR_SET.red,
		CLEAR: COLOUR_SET.green,
		"EXCESSIVE CLEAR": COLOUR_SET.purple,
		"MAXXIVE CLEAR": COLOUR_SET.white,
		"ULTIMATE CHAIN": COLOUR_SET.teal,
		"PERFECT ULTIMATE CHAIN": COLOUR_SET.gold,
	},
};

const USCCoreCells: GPTClientImplementation<GamesForGroup["usc"]>["scoreCoreCells"] = ({ sc }) => (
	<>
		<MillionsScoreCell
			colour={GetEnumColour(sc, "grade")}
			grade={sc.scoreData.grade}
			score={sc.scoreData.score}
		/>
		<SDVXJudgementCell score={sc} />
		<SDVXLampCell score={sc} />
	</>
);

const SDVXCoreCells: GPTClientImplementation<"sdvx">["scoreCoreCells"] = ({ sc }) => (
	<>
		<td
			style={{
				backgroundColor: ChangeOpacity(GetEnumColour(sc, "grade"), 0.2),
			}}
		>
			<strong>{sc.scoreData.grade}</strong>
			<br />
			{FormatMillions(sc.scoreData.score)}
			{typeof sc.scoreData.optional.exScore === "number" && (
				<>
					<br />
					[EX: {sc.scoreData.optional.exScore}]
				</>
			)}
		</td>
		<SDVXJudgementCell score={sc} />
		<SDVXLampCell score={sc} />
	</>
);

const SDVXRatingCell: GPTClientImplementation<SDVXLikes>["ratingCell"] = ({ sc, chart, rating }) =>
	rating === "VF7" ? <VF7Cell chart={chart} score={sc} /> : <VF6Cell chart={chart} score={sc} />;

export const SDVX_IMPL: GPTClientImplementation<"sdvx"> = {
	sessionImportantScoreCount: 50,
	enumColours: SDVXLIKE_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	difficultyColours: {
		NOV: COLOUR_SET.purple,
		ADV: COLOUR_SET.vibrantYellow,
		EXH: COLOUR_SET.red,
		INF: COLOUR_SET.vibrantPink,
		GRV: COLOUR_SET.orange,
		HVN: COLOUR_SET.teal,
		VVD: COLOUR_SET.pink,
		XCD: COLOUR_SET.blue,
		NBL: COLOUR_SET.paleGreen,
		MXM: COLOUR_SET.white,
		ULT: COLOUR_SET.vibrantOrange,
	},
	classColours: {
		dan: {
			DAN_1: bgc(COLOUR_SET.red, "var(--bs-light)"),
			DAN_2: bgc(COLOUR_SET.paleBlue, "var(--bs-light)"),
			DAN_3: bgc("gold", "var(--bs-dark)"),
			DAN_4: bgc("gray", "var(--bs-light)"),
			DAN_5: bgc(COLOUR_SET.teal, "var(--bs-dark)"),
			DAN_6: bgc("blue", "var(--bs-light)"),
			DAN_7: bgc(COLOUR_SET.vibrantPink, "var(--bs-dark)"),
			DAN_8: bgc("pink", "var(--bs-dark)"),
			DAN_9: bgc("white", "var(--bs-dark)"),
			DAN_10: bgc("var(--bs-warning)", "var(--bs-dark)"),
			DAN_11: bgc("var(--bs-danger)", "var(--bs-light)"),
			INF: bgc("purple", "gold"),
		},
		vfClass: {
			SIENNA_I: bgc(COLOUR_SET.red, "var(--bs-light)"),
			SIENNA_II: bgc(COLOUR_SET.red, "var(--bs-light)"),
			SIENNA_III: bgc(COLOUR_SET.red, "var(--bs-light)"),
			SIENNA_IV: bgc(COLOUR_SET.red, "var(--bs-light)"),
			COBALT_I: bgc(COLOUR_SET.paleBlue, "var(--bs-light)"),
			COBALT_II: bgc(COLOUR_SET.paleBlue, "var(--bs-light)"),
			COBALT_III: bgc(COLOUR_SET.paleBlue, "var(--bs-light)"),
			COBALT_IV: bgc(COLOUR_SET.paleBlue, "var(--bs-light)"),
			DANDELION_I: bgc(COLOUR_SET.gold, "var(--bs-dark)"),
			DANDELION_II: bgc(COLOUR_SET.gold, "var(--bs-dark)"),
			DANDELION_III: bgc(COLOUR_SET.gold, "var(--bs-dark)"),
			DANDELION_IV: bgc(COLOUR_SET.gold, "var(--bs-dark)"),
			CYAN_I: bgc(COLOUR_SET.teal, "var(--bs-dark)"),
			CYAN_II: bgc(COLOUR_SET.teal, "var(--bs-dark)"),
			CYAN_III: bgc(COLOUR_SET.teal, "var(--bs-dark)"),
			CYAN_IV: bgc(COLOUR_SET.teal, "var(--bs-dark)"),
			SCARLET_I: bgc(COLOUR_SET.vibrantPink, "var(--bs-dark)"),
			SCARLET_II: bgc(COLOUR_SET.vibrantPink, "var(--bs-dark)"),
			SCARLET_III: bgc(COLOUR_SET.vibrantPink, "var(--bs-dark)"),
			SCARLET_IV: bgc(COLOUR_SET.vibrantPink, "var(--bs-dark)"),
			CORAL_I: bgc(COLOUR_SET.pink, "var(--bs-dark)"),
			CORAL_II: bgc(COLOUR_SET.pink, "var(--bs-dark)"),
			CORAL_III: bgc(COLOUR_SET.pink, "var(--bs-dark)"),
			CORAL_IV: bgc(COLOUR_SET.pink, "var(--bs-dark)"),
			ARGENTO_I: bgc(COLOUR_SET.white, "var(--bs-dark)"),
			ARGENTO_II: bgc(COLOUR_SET.white, "var(--bs-dark)"),
			ARGENTO_III: bgc(COLOUR_SET.white, "var(--bs-dark)"),
			ARGENTO_IV: bgc(COLOUR_SET.white, "var(--bs-dark)"),
			ELDORA_I: bgc("var(--bs-warning)", "var(--bs-dark)"),
			ELDORA_II: bgc("var(--bs-warning)", "var(--bs-dark)"),
			ELDORA_III: bgc("var(--bs-warning)", "var(--bs-dark)"),
			ELDORA_IV: bgc("var(--bs-warning)", "var(--bs-dark)"),
			CRIMSON_I: bgc(COLOUR_SET.vibrantRed, "var(--bs-light)"),
			CRIMSON_II: bgc(COLOUR_SET.vibrantRed, "var(--bs-light)"),
			CRIMSON_III: bgc(COLOUR_SET.vibrantRed, "var(--bs-light)"),
			CRIMSON_IV: bgc(COLOUR_SET.vibrantRed, "var(--bs-light)"),
			IMPERIAL_I: bgc(COLOUR_SET.vibrantPurple, "var(--bs-light)"),
			IMPERIAL_II: bgc(COLOUR_SET.vibrantPurple, "var(--bs-light)"),
			IMPERIAL_III: bgc(COLOUR_SET.vibrantPurple, "var(--bs-light)"),
			IMPERIAL_IV: bgc(COLOUR_SET.vibrantPurple, "var(--bs-light)"),
		},
	},
	ratingSystems: [
		CreateRatingSys(
			"Clear Tierlist",
			"The unofficial SDVX clearing tierlist",
			"lamp",
			(c) => c.data.clearTier?.value,
			(c) => c.data.clearTier?.text,
			(c) => c.data.clearTier?.individualDifference,
			(s) => [s.scoreData.lamp, s.scoreData.lamp !== "FAILED"],
		),
		CreateRatingSys(
			"PUC Tierlist",
			"Tierlist ratings for PUC lamp",
			"lamp",
			(c) => c.data.pucTier?.value,
			(c) => c.data.pucTier?.text,
			(c) => c.data.pucTier?.individualDifference,
			(s) => [
				s.scoreData.lamp,
				s.scoreData.enumIndexes.lamp >= SDVX_LAMPS.PERFECT_ULTIMATE_CHAIN,
			],
		),
		CreateRatingSys(
			"S Tierlist",
			"Tierlist ratings for S grade",
			"grade",
			(c) => c.data.sTier?.value,
			(c) => c.data.sTier?.text,
			(c) => c.data.sTier?.individualDifference,
			(s) => [s.scoreData.grade, s.scoreData.enumIndexes.grade >= SDVX_GRADES.S],
		),
	],
	scoreHeaders: [
		["Score", "Score", NumericSOV((x) => x?.scoreData.score)],
		["Near - Miss", "Nr. Ms.", NumericSOV((x) => x?.scoreData.score)],
		["Lamp", "Lamp", NumericSOV((x) => x?.scoreData.enumIndexes.lamp)],
	],
	scoreCoreCells: SDVXCoreCells,
	ratingCell: SDVXRatingCell,
};
export const USC_IMPL: GPTClientImplementation<GamesForGroup["usc"]> = {
	sessionImportantScoreCount: 50,
	enumColours: SDVXLIKE_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	difficultyColours: {
		NOV: COLOUR_SET.purple,
		ADV: COLOUR_SET.vibrantYellow,
		EXH: COLOUR_SET.red,
		INF: COLOUR_SET.vibrantPink,
	},
	ratingSystems: [],
	scoreHeaders: [
		["Score", "Score", NumericSOV((x) => x?.scoreData.score)],
		["Near - Miss", "Nr. Ms.", NumericSOV((x) => x?.scoreData.score)],
		["Lamp", "Lamp", NumericSOV((x) => x?.scoreData.enumIndexes.lamp)],
	],
	classColours: {
		vfClass: SDVX_IMPL.classColours.vfClass,
	},
	scoreCoreCells: USCCoreCells,
	ratingCell: SDVXRatingCell,
};
