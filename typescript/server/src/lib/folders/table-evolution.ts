import type { ConfEnumScoreMetric } from "tachi-common/types/metrics";

import { SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import { GetSongsByIDs } from "#lib/db-formats/song";
import DB from "#services/pg/db";
import { GetScoresForTableEvolution } from "#utils/queries/scores";
import {
	type ChartDocument,
	type FolderDocument,
	GetGameConfig,
	GetScoreEnumConfs,
	type integer,
	type ScoreDocument,
	type SongDocument,
	type TableDocument,
	type V3Game,
} from "tachi-common";

import { GetFolderChartIDs } from "./folders";

/** One strict improvement on a `(chart × metric)` enum index within table evolution semantics. */
export interface TableEvolutionEvent {
	chartID: string;
	enumIndex: integer;
	metric: string;
	scoreID: string;
	timeAchieved: integer | null;
	timeAdded: integer;
	value: string;
}

export async function GetTableEvolutionFolderChartMembership(
	folders: Array<FolderDocument>,
): Promise<{
	distinctChartIDs: Array<string>;
	folderChartIDs: Record<string, Array<string>>;
}> {
	const folderChartIDs: Record<string, Array<string>> = {};
	const distinct = new Set<string>();

	for (const folder of folders) {
		const chartIds = await GetFolderChartIDs(folder.folderID);

		folderChartIDs[folder.slug] = chartIds;
		for (const id of chartIds) {
			distinct.add(id);
		}
	}

	return { distinctChartIDs: [...distinct], folderChartIDs };
}

export async function LoadEvolutionChartsAndSongs(
	chartIds: Array<string>,
): Promise<{ charts: Array<ChartDocument>; songs: Array<SongDocument> }> {
	if (chartIds.length === 0) {
		return { charts: [], songs: [] };
	}

	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "in", chartIds)
		.execute();

	const charts = rows.map(ToChartDocument);
	const songLegacyIds = [...new Set(charts.map((item) => item.song.id))];
	const songs = await GetSongsByIDs(songLegacyIds);

	return { charts, songs };
}

export function ComputeTableEvolutionEvents(
	scores: Array<ScoreDocument>,
	enumConfs: Record<string, ConfEnumScoreMetric<string>>,
): Array<TableEvolutionEvent> {
	const evolutionEvents: Array<TableEvolutionEvent> = [];

	let currentChartID: string | undefined;
	const prevMaxForMetric: Record<string, integer> = {};

	const readEnumIdx = (
		scoreData: ScoreDocument["scoreData"],
		metric: string,
	): integer | undefined => {
		const fromRoot = scoreData.enumIndexes?.[metric as keyof typeof scoreData.enumIndexes] as
			| integer
			| undefined;
		const fromOptional =
			scoreData.optional?.enumIndexes?.[
				metric as keyof typeof scoreData.optional.enumIndexes
			];

		const coerced = typeof fromOptional === "number" ? fromOptional : undefined;

		return fromRoot ?? coerced ?? undefined;
	};

	for (const score of scores) {
		if (score.chartID !== currentChartID) {
			currentChartID = score.chartID;
			for (const key of Object.keys(prevMaxForMetric)) {
				delete prevMaxForMetric[key];
			}
		}

		for (const [metricName, metricConf] of Object.entries(enumConfs)) {
			if (metricConf.type !== "ENUM") {
				continue;
			}

			const idxRaw = readEnumIdx(score.scoreData, metricName);
			if (idxRaw === undefined) {
				continue;
			}

			const prev = prevMaxForMetric[metricName];
			if (prev !== undefined && idxRaw <= prev) {
				continue;
			}

			prevMaxForMetric[metricName] = idxRaw;

			const minRelIdx = metricConf.values.indexOf(metricConf.minimumRelevantValue);
			if (idxRaw < minRelIdx) {
				continue;
			}

			const valueLabel = metricConf.values[idxRaw];
			if (valueLabel === undefined) {
				continue;
			}

			evolutionEvents.push({
				chartID: score.chartID,
				enumIndex: idxRaw,
				metric: metricName,
				scoreID: score.scoreID,
				timeAchieved: score.timeAchieved,
				timeAdded: score.timeAdded,
				value: valueLabel,
			});
		}
	}

	evolutionEvents.sort((aItem, bItem) => {
		const timeCmp = (aItem.timeAchieved ?? 0) - (bItem.timeAchieved ?? 0);

		return timeCmp !== 0 ? timeCmp : aItem.timeAdded - bItem.timeAdded;
	});

	return evolutionEvents;
}

export async function LoadTableEvolutionPayload(
	userID: integer,
	game: V3Game,
	folders: Array<FolderDocument>,
	table: TableDocument,
): Promise<{
	charts: Array<ChartDocument>;
	events: Array<TableEvolutionEvent>;
	folderChartIDs: Record<string, Array<string>>;
	folders: Array<FolderDocument>;
	songs: Array<SongDocument>;
	table: TableDocument;
}> {
	const enumConfs = GetScoreEnumConfs(GetGameConfig(game));

	const { distinctChartIDs, folderChartIDs } =
		await GetTableEvolutionFolderChartMembership(folders);

	const scores = await GetScoresForTableEvolution(userID, game, distinctChartIDs);
	const events = ComputeTableEvolutionEvents(scores, enumConfs);
	const { charts, songs } = await LoadEvolutionChartsAndSongs(distinctChartIDs);

	return { charts, events, folderChartIDs, folders, songs, table };
}

export async function LoadFolderEvolutionPayload(
	userID: integer,
	game: V3Game,
	folder: FolderDocument,
): Promise<{
	charts: Array<ChartDocument>;
	events: Array<TableEvolutionEvent>;
	folder: FolderDocument;
	folderChartIDs: Record<string, Array<string>>;
	folders: Array<FolderDocument>;
	songs: Array<SongDocument>;
}> {
	const enumConfs = GetScoreEnumConfs(GetGameConfig(game));

	const { distinctChartIDs, folderChartIDs } = await GetTableEvolutionFolderChartMembership([
		folder,
	]);

	const scores = await GetScoresForTableEvolution(userID, game, distinctChartIDs);
	const events = ComputeTableEvolutionEvents(scores, enumConfs);
	const { charts, songs } = await LoadEvolutionChartsAndSongs(distinctChartIDs);

	return {
		charts,
		events,
		folder,
		folderChartIDs,
		folders: [folder],
		songs,
	};
}
