import {
	type ComparePBsDataset,
	type FolderDataset,
	type PBDataset,
	type ScoreDataset,
} from "#types/tables";
import { HumanFriendlyStrToEnumIndex } from "#util/str-to-num";
import { type ValueGetterOrHybrid } from "#util/ztable/search";
import {
	BMS_TABLES,
	type ChartDocument,
	type GameConfig,
	GetGameConfig,
	type PBScoreDocument,
	type ScoreDocument,
	type V3Game,
} from "tachi-common";

function GetBMSTableVal(chart: ChartDocument<"bms-7k" | "bms-14k">, key: string) {
	for (const [table, level] of Object.entries(chart.data.tableFolders)) {
		if (table === key) {
			return Number(level);
		}
	}

	return null;
}

export function CreateDefaultScoreSearchParams<TGame extends V3Game = V3Game>(game: TGame) {
	const gameConfig = GetGameConfig(game);

	const searchFunctions: Record<string, ValueGetterOrHybrid<ScoreDataset<TGame>[0]>> = {
		artist: (x) => x.__related.song.artist,
		title: (x) => x.__related.song.title,
		difficulty: (x) => x.__related.chart.difficulty,
		level: (x) => x.__related.chart.levelNum,
		highlight: (x) => !!x.highlight,
		service: (x) => x.service,
		...GetMetricSearchParams(game),
		...CreateCalcDataSearchFns(gameConfig),
	};

	if (game === "bms-7k" || game === "bms-14k") {
		HandleBMSNonsense(searchFunctions, game as "bms-7k" | "bms-14k", (k) => k.__related.chart);
	}

	return searchFunctions;
}

export function GetMetricSearchParams(
	game: V3Game,
	kMapper: (v: any) => PBScoreDocument | ScoreDocument = (v) => v,
) {
	const searchFns: Record<string, ValueGetterOrHybrid<PBScoreDocument | ScoreDocument>> = {};

	const gameConfig = GetGameConfig(game);

	for (const [metric, conf] of Object.entries({
		...gameConfig.providedMetrics,
		...gameConfig.derivedMetrics,
	})) {
		switch (conf.type) {
			case "ENUM":
				searchFns[metric] = {
					valueGetter: (x) => {
						// @ts-expect-error lol this is fine pls
						const sv = kMapper(x)?.scoreData[metric];

						if (sv === undefined) {
							return null;
						}

						// @ts-expect-error lol this is fine pls
						const dv = kMapper(x)?.scoreData.enumIndexes[metric];

						if (dv === undefined) {
							return null;
						}

						return [sv, dv];
					},
					strToNum: HumanFriendlyStrToEnumIndex(game, metric),
				};
				break;
			case "INTEGER":
			case "DECIMAL":
				// @ts-expect-error lol this is fine pls
				searchFns[metric] = (x) => kMapper(x)?.scoreData[metric] ?? null;
		}
	}

	return searchFns;
}

export function CreateDefaultPBSearchParams<TGame extends V3Game = V3Game>(game: TGame) {
	const gameConfig = GetGameConfig(game);

	const searchFunctions: Record<string, ValueGetterOrHybrid<PBDataset<TGame>[0]>> = {
		artist: (x) => x.__related.song.artist,
		title: (x) => x.__related.song.title,
		difficulty: (x) => x.__related.chart.difficulty,
		level: (x) => x.__related.chart.levelNum,
		ranking: (x) => x.rankingData.rank,
		rivalRanking: (x) => x.rankingData.rivalRank,
		highlight: (x) => !!x.highlight,
		username: (x) => x.__related.user?.username ?? null,
		...GetMetricSearchParams(game),
		...CreateCalcDataSearchFns(gameConfig),
	};

	if (game === "bms-7k" || game === "bms-14k") {
		HandleBMSNonsense(searchFunctions, game as "bms-7k" | "bms-14k", (k) => k.__related.chart);
	}

	return searchFunctions;
}

export function CreatePBCompareSearchParams<TGame extends V3Game = V3Game>(game: TGame) {
	const searchFunctions: Record<string, ValueGetterOrHybrid<ComparePBsDataset<TGame>[0]>> = {
		artist: (x) => x.song.artist,
		title: (x) => x.song.title,
		difficulty: (x) => x.chart.difficulty,
		level: (x) => x.chart.levelNum,
	};

	if (game === "bms-7k" || game === "bms-14k") {
		HandleBMSNonsense(searchFunctions, game as "bms-7k" | "bms-14k", (k) => k.chart);
	}

	return searchFunctions;
}

export function CreateDefaultFolderSearchParams<TGame extends V3Game = V3Game>(game: TGame) {
	const gameConfig = GetGameConfig(game);

	const searchFunctions: Record<string, ValueGetterOrHybrid<FolderDataset<TGame>[0]>> = {
		artist: (x) => x.__related.song.artist,
		title: (x) => x.__related.song.title,
		difficulty: (x) => x.difficulty,
		level: (x) => x.levelNum,
		ranking: (x) => x.__related.pb?.rankingData.rank ?? null,
		rivalRanking: (x) => x.__related.pb?.rankingData.rivalRank ?? null,
		highlight: (x) => !!x.__related.pb?.highlight,
		played: (x) => !!x.__related.pb,
		...GetMetricSearchParams(game, (k) => k.__related.pb),
		...CreateFolderCalcDataSearchFns(gameConfig),
	};

	if (game === "bms-7k" || game === "bms-14k") {
		HandleBMSNonsense(searchFunctions, game as "bms-7k" | "bms-14k", (k) => k);
	}

	return searchFunctions;
}

function CreateFolderCalcDataSearchFns(gameConfig: GameConfig) {
	return Object.fromEntries(
		Object.keys(gameConfig.scoreRatingAlgs).map((e) => [
			e.toLowerCase(),
			// @ts-expect-error this is fine please leave me alone
			(x: FolderDataset[0]) => x.__related.pb?.calculatedData[e] ?? null,
		]),
	);
}

function CreateCalcDataSearchFns(gameConfig: GameConfig) {
	return Object.fromEntries(
		Object.keys(gameConfig.scoreRatingAlgs).map(
			// @ts-expect-error this is fine please leave me alone
			(e) => [e.toLowerCase(), (x: PBDataset[0]) => x.calculatedData[e]],
		),
	);
}

/**
 * Add BMS tables to the list of available searchy things.
 */
function HandleBMSNonsense(
	searchFunctions: Record<string, any>,
	game: "bms-7k" | "bms-14k",
	chartGetter: (u: any) => ChartDocument<"bms-7k" | "bms-14k">,
) {
	const appendSearches: Record<string, ValueGetterOrHybrid<any>> = Object.fromEntries(
		BMS_TABLES.filter((e) => e.game === game).map((e) => [
			e.asciiPrefix,
			(x) => GetBMSTableVal(chartGetter(x), e.prefix),
		]),
	);

	Object.assign(searchFunctions, appendSearches);
}
