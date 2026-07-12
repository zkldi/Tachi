import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { Difficulties, GamesForGroup, Versions } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InvalidScoreFailure,
	SkipScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { FindChartWithSongDifficultyVersion } from "#utils/queries/charts";
import { FindSongOnTitleInsensitive } from "#utils/queries/songs";

import type { S3Score } from "./types";

export function ParseDifficulty(diff: S3Score["diff"]): {
	difficulty: Difficulties[GamesForGroup["iidx"]];
	game: GamesForGroup["iidx"];
} {
	switch (diff) {
		case "L7":
			return { game: "iidx-sp", difficulty: "NORMAL" };
		case 7:
			return { game: "iidx-sp", difficulty: "HYPER" };
		case "A":
			return { game: "iidx-sp", difficulty: "ANOTHER" };
		case "B":
			return { game: "iidx-sp", difficulty: "LEGGENDARIA" };
		case 5:
			throw new SkipScoreFailure(`5KEY scores are not supported.`);
		case "L14":
			return { game: "iidx-dp", difficulty: "NORMAL" };
		case 14:
			return { game: "iidx-dp", difficulty: "HYPER" };
		case "A14":
			return { game: "iidx-dp", difficulty: "ANOTHER" };
		case "B14":
			return { game: "iidx-dp", difficulty: "LEGGENDARIA" };
		default:
			throw new InvalidScoreFailure(`Invalid difficulty ${diff}.`);
	}
}

export function ResolveS3Lamp(data: S3Score): GetEnumValue<GamesForGroup["iidx"], "lamp"> {
	switch (data.cleartype) {
		case "played":
			return "FAILED";
		case "cleared":
			switch (data.mods.hardeasy) {
				case "E":
					return "EASY CLEAR";
				case "H":
					return "HARD CLEAR";
				case undefined:
					return "CLEAR";
				default:
					throw new InvalidScoreFailure(
						`Invalid hardeasy of ${data.mods.hardeasy} while evaluating a 'cleared' score?`,
					);
			}

		case "combo":
		case "comboed":
		case "perfect":
		case "perfected":
			return "FULL COMBO";
		default:
			throw new InvalidScoreFailure(`Invalid cleartype of ${data.cleartype}.`);
	}
}

const S3_VERSION_CONV: Record<string, Versions["iidx-sp"]> = {
	"3rd": "3-cs",
	"4th": "4-cs",
	"5th": "5-cs",
	"6th": "6-cs",
	"7th": "7-cs",
	"8th": "8-cs",
	"9th": "9-cs",
	"10th": "10-cs",
	red: "11-cs",
	hs: "12-cs",
	dd: "13-cs",
	gold: "14-cs",
	djt: "15-cs",
	emp: "16-cs",
	pb: "16-cs",
	us: "bmus",
};

function ConvertVersion(joinedStyles: string) {
	const styles = joinedStyles.split(",");

	const style = styles[styles.length - 1];

	if (!style) {
		throw new InvalidScoreFailure(`Song has invalid style -- Score has no styles?`);
	}

	const maybeConvertedStyle = S3_VERSION_CONV[style];

	if (!maybeConvertedStyle) {
		throw new InvalidScoreFailure(`Song has invalid style ${style}.`);
	}

	return maybeConvertedStyle;
}

export const ConvertFileS3: ConverterFunction<S3Score, EmptyObject> = async (
	data,
	context,
	importType,
	_log,
) => {
	const song = await FindSongOnTitleInsensitive("iidx", data.songname);

	if (!song) {
		throw new SongOrChartNotFoundFailure(
			`Could not find song with title ${data.songname}`,
			importType,
			data,
			context,
		);
	}

	const { game, difficulty } = ParseDifficulty(data.diff);
	const version = ConvertVersion(data.styles);

	const chart = await FindChartWithSongDifficultyVersion(game, song.id, difficulty, version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart ${data.songname} (${game} ${difficulty} version (${version}))`,
			importType,
			data,
			context,
		);
	}

	const lamp = ResolveS3Lamp(data);

	const timeAchieved = ParseDateFromString(data.date);

	let judgements = {};

	if (data.scorebreakdown) {
		judgements = {
			pgreat: data.scorebreakdown.justgreats,
			great: data.scorebreakdown.greats,
			good: data.scorebreakdown.good,
			bad: data.scorebreakdown.bad,
			poor: data.scorebreakdown.poor,
		};
	}

	const dryScore: DryScore<typeof game> = {
		game,
		comment: data.comment ?? null,
		importType: "file/solid-state-squad",
		service: "Solid State Squad",
		scoreData: {
			score: data.exscore,
			lamp,
			judgements,
			optional: {},
		},
		scoreMeta: {},
		timeAchieved,
	};

	return { chart, song, dryScore };
};
