import GitadoraJudgementCell from "#components/tables/cells/GitadoraJudgementCell";
import LampCell from "#components/tables/cells/LampCell";
import RatingCell from "#components/tables/cells/RatingCell";
import ScoreCell from "#components/tables/cells/ScoreCell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GameClientImplementation } from "#lib/types";
import { NumericSOV } from "#util/sorts";
import { COLOUR_SET, type GamesForGroup } from "tachi-common";

import { bgc } from "./_util";

const GITADORA_ENUM_COLOURS: GameClientImplementation<
	"gitadora-dora" | "gitadora-gita"
>["enumColours"] = {
	grade: {
		C: COLOUR_SET.purple,
		B: COLOUR_SET.blue,
		A: COLOUR_SET.green,
		S: COLOUR_SET.orange,
		SS: COLOUR_SET.gold,
		MAX: COLOUR_SET.white,
	},
	lamp: {
		FAILED: COLOUR_SET.red,
		CLEAR: COLOUR_SET.blue,
		"FULL COMBO": COLOUR_SET.teal,
		EXCELLENT: COLOUR_SET.gold,
	},
};

const GITADORA_HEADERS: GameClientImplementation<
	"gitadora-dora" | "gitadora-gita"
>["scoreHeaders"] = [
	["Percent", "Percent", NumericSOV((x) => x.scoreData.percent)],
	["Judgements", "Hits", NumericSOV((x) => x.scoreData.percent)],
	["Lamp", "Lamp", NumericSOV((x) => x.scoreData.enumIndexes.lamp)],
];

const GITADORA_COLOURS: GameClientImplementation<GamesForGroup["gitadora"]>["classColours"] = {
	colour: {
		WHITE: bgc("white", "var(--bs-dark)"),
		ORANGE: bgc("orange", "var(--bs-dark)"),
		ORANGE_GRD: bgc("orange", "var(--bs-dark)"),
		YELLOW: bgc("var(--bs-warning)", "var(--bs-dark)"),
		YELLOW_GRD: bgc("var(--bs-warning)", "var(--bs-dark)"),
		GREEN: bgc("green", "var(--bs-light"),
		GREEN_GRD: bgc("green", "var(--bs-light"),
		BLUE: bgc("var(--bs-info)", "var(--bs-light)"),
		BLUE_GRD: bgc("var(--bs-info)", "var(--bs-light)"),
		PURPLE: bgc("purple", "var(--bs-light)"),
		PURPLE_GRD: bgc("purple", "var(--bs-light)"),
		RED: bgc("var(--bs-danger)", "var(--bs-light)"),
		RED_GRD: bgc("var(--bs-danger)", "var(--bs-light)"),
		BRONZE: bgc("sienna", "var(--bs-light)"),
		SILVER: bgc("silver", "var(--bs-dark)"),
		GOLD: bgc("gold", "var(--bs-dark)"),

		RAINBOW: {
			background:
				"linear-gradient(-45deg, #f0788a, #f48fb1, #9174c2, #79bcf2, #70a173, #f7ff99, #faca7d, #ff9d80, #f0788a)",
			color: "var(--bs-dark)",
		},
	},
};

const GITADORACoreCells: GameClientImplementation<GamesForGroup["gitadora"]>["scoreCoreCells"] = ({
	sc,
}) => (
	<>
		<ScoreCell
			colour={GetEnumColour(sc, "grade")}
			grade={sc.scoreData.grade}
			percent={sc.scoreData.percent}
		/>
		<GitadoraJudgementCell score={sc} />
		<LampCell colour={GetEnumColour(sc, "lamp")} lamp={sc.scoreData.lamp} />
	</>
);

const GITADORARatingCell: GameClientImplementation<GamesForGroup["gitadora"]>["ratingCell"] = ({
	sc,
	rating,
}) => <RatingCell rating={rating} score={sc} />;

export const GITADORA_GITA_IMPL: GameClientImplementation<"gitadora-gita"> = {
	sessionImportantScoreCount: 50,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	enumColours: GITADORA_ENUM_COLOURS,
	difficultyColours: {
		BASIC: COLOUR_SET.blue,
		ADVANCED: COLOUR_SET.orange,
		EXTREME: COLOUR_SET.red,
		MASTER: COLOUR_SET.purple,
		"BASS BASIC": COLOUR_SET.vibrantBlue,
		"BASS ADVANCED": COLOUR_SET.vibrantOrange,
		"BASS EXTREME": COLOUR_SET.vibrantRed,
		"BASS MASTER": COLOUR_SET.vibrantPurple,
	},
	ratingSystems: [],
	scoreHeaders: GITADORA_HEADERS,
	classColours: GITADORA_COLOURS,
	scoreCoreCells: GITADORACoreCells,
	ratingCell: GITADORARatingCell,
};

export const GITADORA_DORA_IMPL: GameClientImplementation<"gitadora-dora"> = {
	sessionImportantScoreCount: 50,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	enumColours: GITADORA_ENUM_COLOURS,
	difficultyColours: {
		BASIC: COLOUR_SET.blue,
		ADVANCED: COLOUR_SET.orange,
		EXTREME: COLOUR_SET.red,
		MASTER: COLOUR_SET.purple,
	},
	ratingSystems: [],
	scoreHeaders: GITADORA_HEADERS,
	classColours: GITADORA_COLOURS,
	scoreCoreCells: GITADORACoreCells,
	ratingCell: GITADORARatingCell,
};
