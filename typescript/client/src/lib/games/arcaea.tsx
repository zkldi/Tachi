import ArcaeaJudgementCell from "#components/tables/cells/ArcaeaJudgementCell";
import LampCell from "#components/tables/cells/LampCell";
import MillionsScoreCell from "#components/tables/cells/MillionsScoreCell";
import RatingCell from "#components/tables/cells/RatingCell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GPTClientImplementation } from "#lib/types";
import { NumericSOV } from "#util/sorts";
import React from "react";
import { COLOUR_SET, type GamesForGroup } from "tachi-common";

import { bgc } from "./_util";

const ARCAEA_DIFFICULTY_COLORS: GPTClientImplementation<
	GamesForGroup["arcaea"]
>["difficultyColours"] = {
	Past: COLOUR_SET.blue,
	Present: COLOUR_SET.green,
	Future: COLOUR_SET.purple,
	Eternal: COLOUR_SET.paleBlue,
	Beyond: COLOUR_SET.vibrantRed,
};

const ARCAEA_ENUM_COLORS: GPTClientImplementation<GamesForGroup["arcaea"]>["enumColours"] = {
	lamp: {
		LOST: COLOUR_SET.red,
		"EASY CLEAR": COLOUR_SET.green,
		CLEAR: COLOUR_SET.purple,
		"HARD CLEAR": COLOUR_SET.vibrantRed,
		"FULL RECALL": COLOUR_SET.vibrantPurple,
		"PURE MEMORY": COLOUR_SET.vibrantBlue,
	},
	grade: {
		D: COLOUR_SET.red,
		C: COLOUR_SET.maroon,
		B: COLOUR_SET.purple,
		A: COLOUR_SET.vibrantPurple,
		AA: COLOUR_SET.blue,
		EX: COLOUR_SET.vibrantBlue,
		"EX+": COLOUR_SET.teal,
	},
};

const ARCAEA_COLORS: GPTClientImplementation<GamesForGroup["arcaea"]>["classColours"] = {
	badge: {
		BLUE: bgc("midnightblue", "var(--bs-light)"),
		GREEN: bgc("darkgreen", "var(--bs-light)"),
		ASH_PURPLE: bgc("indigo", "var(--bs-light)"),
		PURPLE: bgc("purple", "var(--bs-light)"),
		RED: bgc("darkred", "var(--bs-light)"),
		ONE_STAR: bgc("crimson", "var(--bs-light)"),
		TWO_STARS: bgc("darkmagenta", "var(--bs-light)"),
		THREE_STARS: bgc("firebrick", "var(--bs-light)"),
	},
	courseBanner: {
		PHASE_1: bgc("aliceblue", "var(--bs-dark)"),
		PHASE_2: bgc("lightskyblue", "var(--bs-dark)"),
		PHASE_3: bgc("lightblue", "var(--bs-dark)"),
		PHASE_4: bgc("midnightblue", "var(--bs-light)"),
		PHASE_5: bgc("plum", "var(--bs-dark)"),
		PHASE_6: bgc("violet", "var(--bs-dark)"),
		PHASE_7: bgc("orchid", "var(--bs-dark)"),
		PHASE_8: bgc("purple", "var(--bs-light)"),
		PHASE_9: bgc("indigo", "var(--bs-light)"),
		PHASE_10: bgc("firebrick", "var(--bs-light)"),
		PHASE_11: bgc("darkred", "var(--bs-light)"),
		PHASE_12: bgc("blueviolet", "var(--bs-light)"),
	},
};

const ARCAEA_SCORE_HEADERS: GPTClientImplementation<GamesForGroup["arcaea"]>["scoreHeaders"] = [
	["Score", "Score", NumericSOV((x) => x.scoreData.score)],
	["Far - Lost", "Far - Lost", NumericSOV((x) => x.scoreData.score)],
	["Lamp", "Lamp", NumericSOV((x) => x.scoreData.enumIndexes.lamp)],
];

const ArcaeaCoreCells: GPTClientImplementation<GamesForGroup["arcaea"]>["scoreCoreCells"] = ({
	sc,
}) => (
	<>
		<MillionsScoreCell
			colour={GetEnumColour(sc, "grade")}
			grade={sc.scoreData.grade}
			score={sc.scoreData.score}
		/>
		<ArcaeaJudgementCell score={sc} />
		<LampCell colour={GetEnumColour(sc, "lamp")} lamp={sc.scoreData.lamp} />
	</>
);

const ArcaeaRatingCell: GPTClientImplementation<GamesForGroup["arcaea"]>["ratingCell"] = ({
	sc,
	rating,
}) => <RatingCell rating={rating} score={sc} />;

export const ARCAEA_TOUCH_IMPL: GPTClientImplementation<"arcaea"> = {
	sessionImportantScoreCount: 30,
	ratingSystems: [],
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	enumColours: ARCAEA_ENUM_COLORS,
	classColours: ARCAEA_COLORS,
	difficultyColours: ARCAEA_DIFFICULTY_COLORS,
	scoreHeaders: ARCAEA_SCORE_HEADERS,
	scoreCoreCells: ArcaeaCoreCells,
	ratingCell: ArcaeaRatingCell,
};
