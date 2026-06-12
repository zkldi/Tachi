import BPICell from "#components/tables/cells/BPICell";
import DeltaCell from "#components/tables/cells/DeltaCell";
import IIDXLampCell from "#components/tables/cells/IIDXLampCell";
import RatingCell from "#components/tables/cells/RatingCell";
import ScoreCell from "#components/tables/cells/ScoreCell";
import { GetEnumColour } from "#lib/game-implementations";
import { type GameClientImplementation } from "#lib/types";
import { ChangeOpacity } from "#util/color-opacity";
import { NumericSOV } from "#util/sorts";
import { COLOUR_SET, type GamesForGroup, IIDX_LAMPS, IIDXLIKE_GBOUNDARIES } from "tachi-common";

import { bgc, CreateRatingSys } from "./_util";

const IIDX_ENUM_COLOURS: GameClientImplementation<GamesForGroup["iidx"]>["enumColours"] = {
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
};

const IIDX_DIFF_COLOURS: GameClientImplementation<GamesForGroup["iidx"]>["difficultyColours"] = {
	NORMAL: COLOUR_SET.blue,
	HYPER: COLOUR_SET.orange,
	ANOTHER: COLOUR_SET.red,
	LEGGENDARIA: COLOUR_SET.purple,
	"All Scratch NORMAL": COLOUR_SET.blue,
	"All Scratch HYPER": COLOUR_SET.orange,
	"All Scratch ANOTHER": COLOUR_SET.red,
	"All Scratch LEGGENDARIA": COLOUR_SET.purple,
	"Kichiku NORMAL": COLOUR_SET.blue,
	"Kichiku HYPER": COLOUR_SET.orange,
	"Kichiku ANOTHER": COLOUR_SET.red,
	"Kichiku LEGGENDARIA": COLOUR_SET.purple,
	"Kiraku NORMAL": COLOUR_SET.blue,
	"Kiraku HYPER": COLOUR_SET.orange,
	"Kiraku ANOTHER": COLOUR_SET.red,
	"Kiraku LEGGENDARIA": COLOUR_SET.purple,
};

const IIDX_HEADERS: GameClientImplementation<GamesForGroup["iidx"]>["scoreHeaders"] = [
	["Score", "Score", NumericSOV((x) => x.scoreData.percent)],
	["Deltas", "Deltas", NumericSOV((x) => x.scoreData.percent)],
	["Lamp", "Lamp", NumericSOV((x) => x.scoreData.enumIndexes.lamp)],
];

const IIDX_COLOURS: GameClientImplementation<GamesForGroup["iidx"]>["classColours"] = {
	dan: {
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
		DAN_9: bgc("var(--bs-danger)", "var(--bs-dark)"),
		DAN_10: bgc("var(--bs-danger)", "var(--bs-dark)"),
		CHUUDEN: bgc("silver", "black"),
		KAIDEN: bgc("var(--bs-warning)", "var(--bs-dark)"),
	},
};

const IIDXCoreCells: GameClientImplementation<GamesForGroup["iidx"]>["scoreCoreCells"] = ({
	sc,
	chart,
}) => (
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
		<IIDXLampCell chart={chart} sc={sc} />
	</>
);

const IIDX_PROFILE_RATING_VALUE_CELL_STYLE: NonNullable<
	GameClientImplementation<GamesForGroup["iidx"]>["profileRatingAlgRowStyle"]
> = {
	ktLampRating: { backgroundColor: ChangeOpacity(COLOUR_SET.purple, 0.12) },
	ktLampRatingHC: { backgroundColor: ChangeOpacity(COLOUR_SET.orange, 0.14) },
	ktLampRatingEXHC: { backgroundColor: ChangeOpacity(COLOUR_SET.gold, 0.12) },
	BPI: { backgroundColor: ChangeOpacity(COLOUR_SET.paleBlue, 0.12) },
};

const IIDXRatingCell: GameClientImplementation<GamesForGroup["iidx"]>["ratingCell"] = ({
	sc,
	chart,
	rating,
}) => (
	<>
		{rating === "BPI" ? (
			<BPICell chart={chart} score={sc} />
		) : (
			<RatingCell rating={rating} score={sc} />
		)}
	</>
);

export const IIDX_SP_IMPL: GameClientImplementation<"iidx-sp"> = {
	sessionImportantScoreCount: 20,
	difficultyColours: IIDX_DIFF_COLOURS,
	enumColours: IIDX_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	ratingSystems: [
		CreateRatingSys(
			"NC Tier",
			"Tierlist Ratings for Normal Clears.",
			"lamp",
			(c) => c.data.ncTier?.value,
			(c) => c.data.ncTier?.text,
			(c) => c.data.ncTier?.individualDifference,
			(s) => [s.scoreData.lamp, s.scoreData.enumIndexes.lamp >= IIDX_LAMPS.CLEAR],
		),
		CreateRatingSys(
			"HC Tier",
			"Tierlist Ratings for Hard Clears.",
			"lamp",
			(c) => c.data.hcTier?.value,
			(c) => c.data.hcTier?.text,
			(c) => c.data.hcTier?.individualDifference,
			(s) => [s.scoreData.lamp, s.scoreData.enumIndexes.lamp >= IIDX_LAMPS.HARD_CLEAR],
		),
		CreateRatingSys(
			"EXHC Tier",
			"Tierlist Ratings for EX-HARD Clears.",
			"lamp",
			(c) => c.data.exhcTier?.value,
			(c) => c.data.exhcTier?.text,
			(c) => c.data.exhcTier?.individualDifference,
			(s) => [s.scoreData.lamp, s.scoreData.enumIndexes.lamp >= IIDX_LAMPS.EX_HARD_CLEAR],
		),
	],
	scoreHeaders: IIDX_HEADERS,
	classColours: IIDX_COLOURS,
	scoreCoreCells: IIDXCoreCells,
	ratingCell: IIDXRatingCell,
	profileRatingAlgRowStyle: IIDX_PROFILE_RATING_VALUE_CELL_STYLE,
};

export const IIDX_DP_IMPL: GameClientImplementation<"iidx-dp"> = {
	sessionImportantScoreCount: 20,
	difficultyColours: IIDX_DIFF_COLOURS,
	enumColours: IIDX_ENUM_COLOURS,
	enumIcons: {
		grade: "sort-alpha-up",
		lamp: "lightbulb",
	},
	ratingSystems: [
		CreateRatingSys(
			"DP Tier",
			"The unofficial DP tiers, taken from https://zasa.sakura.ne.jp/dp/run.php.",
			"lamp",
			(c) => c.data.dpTier?.value,
			(c) => c.data.dpTier?.text,
			() => undefined,
			(s) => [s.scoreData.lamp, s.scoreData.enumIndexes.lamp >= IIDX_LAMPS.CLEAR],
		),
	],
	scoreHeaders: IIDX_HEADERS,
	classColours: IIDX_COLOURS,
	scoreCoreCells: IIDXCoreCells,
	ratingCell: IIDXRatingCell,
	profileRatingAlgRowStyle: IIDX_PROFILE_RATING_VALUE_CELL_STYLE,
};
