import type { PrudenceError, ValidSchemaValue } from "prudence";
import type { ZodObject } from "zod";

import type { GradeBoundary, IIDXLikes } from "../constants/grade-boundaries";
import type {
	BMSCourseDocument,
	BMSGames,
	ChartDocument,
	GameGroup,
	GamesForGroup,
	integer,
	LEGACY_Playtypes,
	SEEDS_BMSCourseDocument,
	SEEDS_SongDocument,
	SongDocument,
	V3Game,
} from "../types";
import type {
	AllConfMetrics,
	ConfEnumScoreMetric,
	ExtractEnumMetricNames,
	GetEnumValue,
} from "../types/metrics";

import {
	ALL_GAMES,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	LEGACY_GameToGameGroupPT,
} from "../config/config";

/**
 * Stick this in the "default" branch of switch exprs to statically typecheck that your
 * switch is exhaustive.
 *
 * This works because the argument to this function should be "never" because all of its
 * variants should be exhausted.
 */
export function staticAssertUnreachable(_: never): never {
	throw new Error(`unreachable (Got ${JSON.stringify(_)})`);
}

export function FormatInt(v: number): string {
	return Math.floor(v).toFixed(0);
}

/**
 * Formats a chart's difficulty into a longer variant. This handles a lot of
 * game-specific strange edge cases.
 */
export function FormatDifficultyLong(chart: ChartDocument): string {
	return FormatDifficultyInternal(chart, false);
}

/**
 * Formats a chart's difficulty into a shorter variant. This handles a lot of
 * game-specific strange edge cases.
 */
export function FormatDifficultyShort(chart: ChartDocument): string {
	return FormatDifficultyInternal(chart, true);
}

function FormatDifficultyInternal(chart: ChartDocument, short: boolean): string {
	const gameGroup = GameToGameGroup(chart.game);
	const gameConfig = GetGameConfig(chart.game);

	if (gameGroup === "bms" || gameGroup === "pms") {
		const bmsChart = chart as ChartDocument<BMSGames>;

		return (
			Object.entries(bmsChart.data.tableFolders)
				.map(([table, level]) => `${table}${level}`)
				.join(", ") || "Unrated"
		);
	}
	if (gameGroup === "itg") {
		const itgChart = chart as ChartDocument<"itg-stamina">;

		const level = itgChart.data.rankedLevel ?? itgChart.data.chartLevel;
		const unranked = itgChart.data.rankedLevel === null ? "UNRANKED " : "";

		return `${unranked}${itgChart.data.difficultyTag} ${level} (${itgChart.data.charter})`;
	}

	// use the difficulty format there
	if (
		gameConfig.difficulties.type === "FIXED" ||
		gameConfig.difficulties.type === "CHUGEKIMAI_STYLE"
	) {
		let diff;
		if (short) {
			diff = gameConfig.difficulties.formatShort[chart.difficulty];
		} else {
			diff = gameConfig.difficulties.formatLong[chart.difficulty];
		}

		diff ??= chart.difficulty;

		return `${diff} ${chart.level}`.trim();
	}

	// TODO cap string length
	return `${chart.difficulty} ${chart.level}`.trim();
}

/**
 * Formats a chart's difficulty for searching, such as forwarding this query to youtube.
 */
export function FormatDifficultySearch(chart: ChartDocument): string | null {
	const gameGroup = GameToGameGroup(chart.game);
	const gameConfig = GetGameConfig(chart.game);

	if (["bms", "itg", "pms"].includes(gameGroup)) {
		return null;
	}

	let diff: string | undefined;
	if (
		gameConfig.difficulties.type === "FIXED" ||
		gameConfig.difficulties.type === "CHUGEKIMAI_STYLE"
	) {
		diff = gameConfig.difficulties.formatLong[chart.difficulty];
	}
	diff ??= chart.difficulty;
	return diff.trim();
}

export function FormatGame(game: V3Game): string {
	const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);
	return LEGACY_FormatGameGroupPT(gameGroup, playtype);
}

export function LEGACY_FormatGameGroupPT(
	game: GameGroup,
	playtype: LEGACY_Playtypes[GameGroup],
): string {
	const gameConfig = GetGameGroupConfig(game);

	if (gameConfig.playtypes.length === 1) {
		return gameConfig.name;
	}

	if (game === "usc" && playtype === "Keyboard") {
		return `${gameConfig.name} (Keyboard/Other)`;
	}

	return `${gameConfig.name} (${playtype})`;
}

export function FormatChart(chart: ChartDocument): string {
	const gameGroup = GameToGameGroup(chart.game);
	if (gameGroup === "bms") {
		const tables = (chart as ChartDocument<GamesForGroup["bms"]>).data.tableFolders;

		const bmsSong = chart.song as SongDocument<"bms">;

		let realTitle = bmsSong.title;

		if (bmsSong.data.subtitle) {
			realTitle = `${realTitle} - ${bmsSong.data.subtitle}`;
		}

		if (bmsSong.data.genre) {
			realTitle = `${realTitle} [${bmsSong.data.genre}]`;
		}

		if (Object.keys(tables).length === 0) {
			return realTitle;
		}

		return `${realTitle} (${Object.entries(tables)
			.map(([table, level]) => `${table}${level}`)
			.join(", ")})`;
	} else if (gameGroup === "usc") {
		const uscChart = chart as ChartDocument<GamesForGroup["usc"]>;
		const inputType = chart.game === "usc-controller" ? "Controller" : "Keyboard";

		// If this chart isn't an official, render it differently
		if (!uscChart.data.isOfficial) {
			// Same as BMS. turn this into SongTitle (Keyboard MXM normal1, insane2)
			return `${chart.song.title} (${inputType} ${chart.difficulty} ${Object.entries(
				uscChart.data.tableFolders,
			)
				.map(([table, level]) => `${table}${level}`)
				.join(", ")})`;
		} else if (Object.keys(uscChart.data.tableFolders).length !== 0) {
			// if this chart is an official **AND** is on tables (unlikely), render
			// it as so:

			// SongTitle (Keyboard MXM 17, normal1, insane2)
			return `${chart.song.title} (${inputType} ${chart.difficulty} ${
				chart.level
			}, ${Object.entries(uscChart.data.tableFolders)
				.map(([table, level]) => `${table}${level}`)
				.join(", ")})`;
		}

		// otherwise, it's just an official and should be rendered like any other game.
	} else if (gameGroup === "itg") {
		const itgChart = chart as ChartDocument<GamesForGroup["itg"]>;
		const itgSong = chart.song as SongDocument<"itg">;

		const level = itgChart.data.rankedLevel ?? `${itgChart.data.chartLevel}?`;

		return `${itgSong.title}${itgSong.data.subtitle ? ` ${itgSong.data.subtitle}` : ""} ${
			itgChart.data.difficultyTag
		} ${level}`;
	}

	const gameConfig = GetGameConfig(chart.game);

	let diff: string;

	if (gameConfig.difficulties.type === "DYNAMIC") {
		diff = chart.difficulty;
	} else {
		diff = gameConfig.difficulties.formatShort[chart.difficulty] ?? chart.difficulty;
	}

	// return the most recent version this chart appeared in if it
	// is not primary.
	if (!chart.isPrimary) {
		return `${chart.song.title} (${diff} ${chart.level} ${chart.versions[0]})`;
	}

	return `${chart.song.title} (${diff} ${chart.level})`;
}

/**
 * Run a zod schema inside prudence.
 */
export function PrudenceZodShim(zodSchema: ZodObject): ValidSchemaValue {
	return (self) => {
		const res = zodSchema.safeParse(self);

		if (res.success) {
			return true;
		}

		return res.error.message;
	};
}

/**
 * Formats a number (14100) into "14K".
 */
export function FmtNumCompact(num: number) {
	return Intl.NumberFormat("en", { notation: "compact" }).format(num);
}

/**
 * Formats a number (14100) into "14,100"
 */
export function FmtNum(num: number) {
	return num.toLocaleString();
}

export function FmtPercent(v: number, dp = 2) {
	return `${v.toFixed(dp)}%`;
}

/**
 * Turns a number of 12834 into "12834" instead of "12,834".
 */
export function FmtScoreNoCommas(v: number) {
	return v.toString();
}

function WrapGrade(grade: string) {
	if (grade.endsWith("-") || grade.endsWith("+")) {
		return `(${grade})`;
	}

	return grade;
}

function RelativeGradeDelta<G extends string>(
	gradeBoundaries: Array<GradeBoundary<G>>,
	scoreGrade: G,
	scoreValue: number,
	// Positive number means higher grade, etc.
	relativeIndex: number,
) {
	const gradeBoundary =
		gradeBoundaries[gradeBoundaries.findIndex((e) => e.name === scoreGrade) + relativeIndex];

	if (!gradeBoundary) {
		return null;
	}

	return AbsoluteGradeDelta(gradeBoundary, scoreValue);
}

function AbsoluteGradeDelta<G extends string>(gradeBoundary: GradeBoundary<G>, scoreValue: number) {
	return {
		grade: gradeBoundary.name,
		delta: scoreValue - gradeBoundary.lowerBound,
	};
}

export function GetGradeDeltas<G extends string>(
	gradeBoundaries: Array<GradeBoundary<G>>,
	scoreGrade: G,
	scoreValue: number,
	formatNumFn = FmtNumCompact,
) {
	const scoreGradeBoundary = gradeBoundaries.find((e) => e.name === scoreGrade);

	if (!scoreGradeBoundary) {
		throw new Error(
			`Passed a scoreGrade of ${scoreGrade} but no such boundary exists in ${gradeBoundaries
				.map((e) => e.name)
				.join(", ")}`,
		);
	}

	const upper = RelativeGradeDelta(gradeBoundaries, scoreGrade, scoreValue, 1);
	const lower = AbsoluteGradeDelta(scoreGradeBoundary, scoreValue);

	const formatLower = `${WrapGrade(lower.grade)}+${formatNumFn(lower.delta)}`;

	// there might be *no* grade above this one, in this case lower obviously wins.
	if (!upper) {
		return {
			lower: formatLower,
			closer: "lower",
		};
	}

	// this will automatically have a - separating the two.
	const formatUpper = `${WrapGrade(upper.grade)}${formatNumFn(upper.delta)}`;

	// are we closer to the lower bound, or the upper one?
	let closer: "lower" | "upper" = upper.delta + lower.delta < 0 ? "lower" : "upper";

	// lovely hardcoded exception for IIDXLikes - (MAX-)+ is always a stupid metric
	// so always mute it.
	if (formatLower.startsWith("(MAX-)+")) {
		closer = "upper";
	}

	return {
		lower: formatLower,
		upper: formatUpper,
		closer,
	};
}

export function GetCloserGradeDelta<G extends string>(
	gradeBoundaries: Array<GradeBoundary<G>>,
	scoreGrade: G,
	scoreValue: number,
	formatNumFn = FmtNumCompact,
): string {
	const { lower, upper, closer } = GetGradeDeltas(
		gradeBoundaries,
		scoreGrade,
		scoreValue,
		formatNumFn,
	);

	if (closer === "upper") {
		// this type assertion is unecessary in theory, but in practice older versions
		// of TS aren't happy with it.

		return upper!;
	}

	return lower;
}

export function CreateSongMap<G extends GameGroup = GameGroup>(
	songs: Array<SEEDS_SongDocument<G> | SongDocument<G>>,
) {
	const songMap = new Map<string, SongDocument<G>>();

	for (const song of songs) {
		songMap.set(song.id, song as SongDocument<G>);
	}

	return songMap;
}

export function CreateChartMap<TGame extends V3Game = V3Game>(charts: Array<ChartDocument<TGame>>) {
	const chartMap = new Map<string, ChartDocument<TGame>>();

	for (const chart of charts) {
		chartMap.set(chart.chartID, chart);
	}

	return chartMap;
}

/**
 * Formats a PrudenceError into something a little more readable.
 * @param err - The prudence error to format.
 * @param foreword - A description of what kind of error this was. Defaults to "Error".
 */
export function FormatPrError(err: PrudenceError, foreword = "Error"): string {
	const receivedText =
		typeof err.userVal === "object" && err.userVal !== null
			? ""
			: ` | Received ${err.userVal} [${err.userVal === null ? "null" : typeof err.userVal}]`;

	return `${foreword}: ${err.keychain} | ${err.message}${receivedText}.`;
}

export function GetBMSCourseIndex(course: BMSCourseDocument | SEEDS_BMSCourseDocument) {
	const gameConfig = GetGameConfig(course.game);

	const cls = gameConfig.classes[course.set as keyof typeof gameConfig.classes];

	if (!cls) {
		throw new Error(
			`Invalid BMSCourse set of ${course.set}. No classes are defined for this set.`,
		);
	}

	return cls.values.findIndex((e) => e.id === course.value);
}

/**
 * Util for getting a games' grade for a given score.
 */
export function GetGrade<G extends string>(grades: Array<GradeBoundary<G>>, score: number): G {
	// sort grades going downwards in their boundaries.
	const descendingGrades = grades.slice(0).sort((a, b) => b.lowerBound - a.lowerBound);

	for (const { name, lowerBound } of descendingGrades) {
		if (score >= lowerBound) {
			return name;
		}
	}

	throw new Error(`Could not resolve grade for score ${score}.`);
}

export function IIDXLikeGetGrade(
	score: integer,
	notecount: integer,
): GetEnumValue<IIDXLikes, "grade"> {
	const total = notecount * 2;

	if (score === total) {
		return "MAX";
	} else if (score * 18 >= total * 17) {
		return "MAX-";
	} else if (score * 9 >= total * 8) {
		return "AAA";
	} else if (score * 9 >= total * 7) {
		return "AA";
	} else if (score * 9 >= total * 6) {
		return "A";
	} else if (score * 9 >= total * 5) {
		return "B";
	} else if (score * 9 >= total * 4) {
		return "C";
	} else if (score * 9 >= total * 3) {
		return "D";
	} else if (score * 9 >= total * 2) {
		return "E";
	}

	return "F";
}

export function EnumIndexToValue<
	TGame extends V3Game,
	EV extends ExtractEnumMetricNames<AllConfMetrics[TGame]>,
>(game: TGame, enumMetric: EV, index: integer): GetEnumValue<TGame, EV> {
	const config = GetGameConfig(game);

	let metric = config.providedMetrics[enumMetric];
	if (!metric) {
		metric = config.derivedMetrics[enumMetric];
	}
	if (!metric) {
		metric = config.optionalMetrics[enumMetric];
	}

	if (!metric) {
		throw new Error(`Invalid enum metric ${enumMetric} for game ${game}.`);
	}

	return (metric as ConfEnumScoreMetric<string>).values[index] as GetEnumValue<TGame, EV>;
}

export function IsValidGame(game: string): game is V3Game {
	return ALL_GAMES.includes(game as unknown as V3Game);
}
