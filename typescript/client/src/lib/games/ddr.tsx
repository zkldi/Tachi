import DDRScoreCell from "#components/tables/cells/DDRScoreCell";
import FlareCell from "#components/tables/cells/FlareCell";
import LampCell from "#components/tables/cells/LampCell";
import RatingCell from "#components/tables/cells/RatingCell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GameClientImplementation } from "#lib/types";
import { NumericSOV } from "#util/sorts";
import { COLOUR_SET, type GamesForGroup } from "tachi-common";

import { bgc } from "./_util";

const DDR_ENUM_COLOURS: GameClientImplementation<GamesForGroup["ddr"]>["enumColours"] = {
	grade: {
		E: COLOUR_SET.gray,
		D: COLOUR_SET.paleBlue,
		"D+": COLOUR_SET.paleBlue,
		"C-": COLOUR_SET.purple,
		C: COLOUR_SET.purple,
		"C+": COLOUR_SET.purple,
		"B-": COLOUR_SET.blue,
		B: COLOUR_SET.blue,
		"B+": COLOUR_SET.blue,
		"A-": COLOUR_SET.gold,
		A: COLOUR_SET.gold,
		"A+": COLOUR_SET.gold,
		"AA-": COLOUR_SET.gold,
		AA: COLOUR_SET.gold,
		"AA+": COLOUR_SET.gold,
		AAA: COLOUR_SET.teal,
	},
	lamp: {
		FAILED: COLOUR_SET.maroon,
		ASSIST: COLOUR_SET.purple,
		CLEAR: COLOUR_SET.blue,
		"FULL COMBO": COLOUR_SET.vibrantBlue,
		"GREAT FULL COMBO": COLOUR_SET.vibrantGreen,
		"PERFECT FULL COMBO": COLOUR_SET.gold,
		"MARVELOUS FULL COMBO": COLOUR_SET.pink,
		LIFE4: COLOUR_SET.vibrantRed,
	},
};

const DDR_DIFF_COLOURS: GameClientImplementation<GamesForGroup["ddr"]>["difficultyColours"] = {
	BEGINNER: COLOUR_SET.blue,
	BASIC: COLOUR_SET.paleGreen,
	DIFFICULT: COLOUR_SET.red,
	EXPERT: COLOUR_SET.vibrantYellow,
	CHALLENGE: COLOUR_SET.purple,
};

const DDR_HEADERS: GameClientImplementation<"ddr-dp" | "ddr-sp">["scoreHeaders"] = [
	["Score", "Score", NumericSOV((x) => x.scoreData.score)],
	["Flare", "Flare", NumericSOV((x) => x.scoreData.optional.enumIndexes.flare ?? 0)],
	["Lamp", "Lamp", NumericSOV((x) => x.scoreData.enumIndexes.lamp)],
];

const DDR_COLOURS: GameClientImplementation<"ddr-dp" | "ddr-sp">["classColours"] = {
	flare: {
		NONE: bgc("gray", "black"),
		"NONE+": bgc("gray", "black"),
		"NONE++": bgc("gray", "black"),
		"NONE+++": bgc("gray", "black"),
		MERCURY: bgc("blue", "white"),
		"MERCURY+": bgc("blue", "white"),
		"MERCURY++": bgc("blue", "white"),
		"MERCURY+++": bgc("blue", "white"),
		VENUS: bgc("yellow", "black"),
		"VENUS+": bgc("yellow", "black"),
		"VENUS++": bgc("yellow", "black"),
		"VENUS+++": bgc("yellow", "black"),
		EARTH: bgc("forestgreen", "black"),
		"EARTH+": bgc("forestgreen", "black"),
		"EARTH++": bgc("forestgreen", "black"),
		"EARTH+++": bgc("forestgreen", "black"),
		MARS: bgc("red", "white"),
		"MARS+": bgc("red", "white"),
		"MARS++": bgc("red", "white"),
		"MARS+++": bgc("red", "white"),
		JUPITER: bgc("darkgreen", "white"),
		"JUPITER+": bgc("darkgreen", "white"),
		"JUPITER++": bgc("darkgreen", "white"),
		"JUPITER+++": bgc("darkgreen", "white"),
		SATURN: bgc("purple", "white"),
		"SATURN+": bgc("purple", "white"),
		"SATURN++": bgc("purple", "white"),
		"SATURN+++": bgc("purple", "white"),
		URANUS: bgc("powderblue", "black"),
		"URANUS+": bgc("powderblue", "black"),
		"URANUS++": bgc("powderblue", "black"),
		"URANUS+++": bgc("powderblue", "black"),
		NEPTUNE: bgc("darkslateblue", "white"),
		"NEPTUNE+": bgc("darkslateblue", "white"),
		"NEPTUNE++": bgc("darkslateblue", "white"),
		"NEPTUNE+++": bgc("darkslateblue", "white"),
		SUN: bgc("orange", "black"),
		"SUN+": bgc("orange", "black"),
		"SUN++": bgc("orange", "black"),
		"SUN+++": bgc("orange", "black"),
		WORLD: bgc("black", "white"),
	},
};

const DDRCoreCells: GameClientImplementation<GamesForGroup["ddr"]>["scoreCoreCells"] = ({
	sc,
	chart: _chart,
}) => (
	<>
		<DDRScoreCell
			colour={GetEnumColour(sc, "grade")}
			grade={sc.scoreData.grade}
			score={sc.scoreData.score}
		/>
		<FlareCell value={sc.scoreData.optional.flare ?? "0"}></FlareCell>
		<LampCell colour={GetEnumColour(sc, "lamp")} lamp={sc.scoreData.lamp} />
	</>
);

const DDRRatingCell: GameClientImplementation<GamesForGroup["ddr"]>["ratingCell"] = ({
	sc,
	chart: _chart,
	rating,
}) => (
	<>
		<RatingCell rating={rating} score={sc} />
	</>
);

export const DDR_SP_IMPL: GameClientImplementation<"ddr-sp"> = {
	sessionImportantScoreCount: 20,
	difficultyColours: DDR_DIFF_COLOURS,
	enumColours: DDR_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	ratingSystems: [],
	scoreHeaders: DDR_HEADERS,
	classColours: DDR_COLOURS,
	scoreCoreCells: DDRCoreCells,
	ratingCell: DDRRatingCell,
};

export const DDR_DP_IMPL: GameClientImplementation<"ddr-dp"> = {
	sessionImportantScoreCount: 20,
	difficultyColours: DDR_DIFF_COLOURS,
	enumColours: DDR_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	ratingSystems: [],
	scoreHeaders: DDR_HEADERS,
	classColours: DDR_COLOURS,
	scoreCoreCells: DDRCoreCells,
	ratingCell: DDRRatingCell,
};
