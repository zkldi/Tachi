import { p } from "prudence";

import type {
	GameConfig,
	GameGroup,
	GameGroupConfig,
	SpecificGameConfig,
	V3Game,
} from "../types/game-config";
import type { ScoreRatingAlgorithmConfig } from "../types/game-config-utils";
import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../types/internals";
import type { ConfEnumScoreMetric, ConfScoreMetric } from "../types/metrics";

import { GAME_ARCAEA_CONF, GAME_GROUP_ARCAEA_CONF } from "./game-support/arcaea";
import { GAME_BMS_7K_CONF, GAME_BMS_14K_CONF, GAME_GROUP_BMS_CONF } from "./game-support/bms";
import { GAME_CHUNITHM_CONF, GAME_GROUP_CHUNITHM_CONF } from "./game-support/chunithm";
import { GAME_DDR_DP_CONF, GAME_DDR_SP_CONF, GAME_GROUP_DDR_CONF } from "./game-support/ddr";
import {
	GAME_GITADORA_DORA_CONF,
	GAME_GITADORA_GITA_CONF,
	GAME_GROUP_GITADORA_CONF,
} from "./game-support/gitadora";
import { GAME_GROUP_IIDX_CONF, GAME_IIDX_DP_CONF, GAME_IIDX_SP_CONF } from "./game-support/iidx";
import { GAME_GROUP_ITG_CONF, GAME_ITG_STAMINA_CONF } from "./game-support/itg";
import { GAME_GROUP_JUBEAT_CONF, GAME_JUBEAT_SINGLE_CONF } from "./game-support/jubeat";
import { GAME_GROUP_MAIMAI_CONF, GAME_MAIMAI_CONF } from "./game-support/maimai";
import { GAME_GROUP_MAIMAI_DX_CONF, GAME_MAIMAI_DX_CONF } from "./game-support/maimai-dx";
import { GAME_GROUP_MUSECA_CONF, GAME_MUSECA_CONF } from "./game-support/museca";
import { GAME_GROUP_ONGEKI_CONF, GAME_ONGEKI_CONF } from "./game-support/ongeki";
import {
	GAME_PMS_CONF,
	GAME_PMS_CONTROLLER_CONF,
	GAME_PMS_KEYBOARD_CONF,
} from "./game-support/pms";
import { GAME_GROUP_POPN_CONF, GAME_POPN_CONF } from "./game-support/popn";
import { GAME_GROUP_SDVX_CONF, GAME_SDVX_CONF } from "./game-support/sdvx";
import {
	GAME_GROUP_USC_CONF,
	GAME_USC_CONTROLLER_CONF,
	GAME_USC_KEYBOARD_CONF,
} from "./game-support/usc";
import { GAME_GROUP_WACCA_CONF, GAME_WACCA_CONF } from "./game-support/wacca";

/**
 * All game groups that Tachi supports.
 *
 * @warn DO NOT ACCESS THIS DIRECTLY! Use @see {GetGameGroupConfig} for better type safety.
 */
export const GAME_GROUP_CONFIGS = {
	iidx: GAME_GROUP_IIDX_CONF,
	museca: GAME_GROUP_MUSECA_CONF,
	chunithm: GAME_GROUP_CHUNITHM_CONF,
	bms: GAME_GROUP_BMS_CONF,
	gitadora: GAME_GROUP_GITADORA_CONF,
	jubeat: GAME_GROUP_JUBEAT_CONF,
	maimai: GAME_GROUP_MAIMAI_CONF,
	maimaidx: GAME_GROUP_MAIMAI_DX_CONF,
	popn: GAME_GROUP_POPN_CONF,
	sdvx: GAME_GROUP_SDVX_CONF,
	usc: GAME_GROUP_USC_CONF,
	wacca: GAME_GROUP_WACCA_CONF,
	pms: GAME_PMS_CONF,
	itg: GAME_GROUP_ITG_CONF,
	arcaea: GAME_GROUP_ARCAEA_CONF,
	ongeki: GAME_GROUP_ONGEKI_CONF,
	ddr: GAME_GROUP_DDR_CONF,
} as const satisfies Record<string, INTERNAL_GAME_GROUP_CONFIG>;

/**
 * Returns the configuration for this game.
 */
export function GetGameGroupConfig<G extends GameGroup>(game: G): GameGroupConfig<G> {
	// Hacky force-type-cast here. TypeScript gets a little confused with
	// the amount of (frankly insane) type screwery going on here.
	return GAME_GROUP_CONFIGS[game] as unknown as GameGroupConfig<G>;
}

/**
 * Based on every declared playtype for every declared game, they all need a GPT
 * config. This controls almost everything about each GPT.
 */
export const GAME_CONFIGS = {
	"iidx-sp": GAME_IIDX_SP_CONF,
	"iidx-dp": GAME_IIDX_DP_CONF,
	museca: GAME_MUSECA_CONF,
	sdvx: GAME_SDVX_CONF,
	"bms-7k": GAME_BMS_7K_CONF,
	"bms-14k": GAME_BMS_14K_CONF,
	"gitadora-gita": GAME_GITADORA_GITA_CONF,
	"gitadora-dora": GAME_GITADORA_DORA_CONF,
	chunithm: GAME_CHUNITHM_CONF,
	wacca: GAME_WACCA_CONF,
	jubeat: GAME_JUBEAT_SINGLE_CONF,
	popn: GAME_POPN_CONF,
	maimai: GAME_MAIMAI_CONF,
	maimaidx: GAME_MAIMAI_DX_CONF,
	"pms-controller": GAME_PMS_CONTROLLER_CONF,
	"pms-keyboard": GAME_PMS_KEYBOARD_CONF,
	"usc-controller": GAME_USC_CONTROLLER_CONF,
	"usc-keyboard": GAME_USC_KEYBOARD_CONF,
	"itg-stamina": GAME_ITG_STAMINA_CONF,
	arcaea: GAME_ARCAEA_CONF,
	ongeki: GAME_ONGEKI_CONF,
	"ddr-sp": GAME_DDR_SP_CONF,
	"ddr-dp": GAME_DDR_DP_CONF,
} as const satisfies Record<V3Game, INTERNAL_GAME_CONFIG>;

export const allSupportedGameGroups = Object.keys(GAME_GROUP_CONFIGS) as Array<GameGroup>;

// All games that tachi supports.
export const ALL_GAMES = allSupportedGameGroups.flatMap(
	(group) => GetGameGroupConfig(group).games,
) as Array<V3Game>;

export function GameToGameGroup(game: V3Game): GameGroup {
	// TODO(zk): shouldn't this be a part of game config?
	const mapping: Record<V3Game, GameGroup> = {
		"iidx-sp": "iidx",
		"iidx-dp": "iidx",
		museca: "museca",
		sdvx: "sdvx",
		"bms-14k": "bms",
		"bms-7k": "bms",
		"gitadora-dora": "gitadora",
		"gitadora-gita": "gitadora",
		chunithm: "chunithm",
		wacca: "wacca",
		jubeat: "jubeat",
		popn: "popn",
		maimai: "maimai",
		maimaidx: "maimaidx",
		"pms-controller": "pms",
		"pms-keyboard": "pms",
		"usc-controller": "usc",
		"usc-keyboard": "usc",
		"itg-stamina": "itg",
		arcaea: "arcaea",
		ongeki: "ongeki",
		"ddr-sp": "ddr",
		"ddr-dp": "ddr",
	};

	return mapping[game];
}

export function GetGameConfig(game: V3Game): GameConfig {
	return GAME_CONFIGS[game] as unknown as GameConfig;
}

export function GetProvidedClassSetsForGame(
	game: V3Game,
): Array<keyof GameConfig["classes"] & string> {
	const config = GetGameConfig(game);

	return Object.entries(config.classes)
		.filter(([, classConfig]) => classConfig.type === "PROVIDED")
		.map(([classSet]) => classSet);
}

export function GameGroupHasProvidedClasses(gameGroup: GameGroup): boolean {
	return GetGameGroupConfig(gameGroup).games.some(
		(game) => GetProvidedClassSetsForGame(game).length > 0,
	);
}

export function GetGamesWithProvidedClasses(gameGroup: GameGroup): Array<V3Game> {
	return GetGameGroupConfig(gameGroup).games.filter(
		(game) => GetProvidedClassSetsForGame(game).length > 0,
	);
}

/**
 * Returns the configuration for this specific game. This type is narrowed
 * down to its least generic form, and is instead for game-specific use cases.
 */
export function GetSpecificGameConfig<TGame extends V3Game>(game: TGame) {
	return GAME_CONFIGS[game] as unknown as SpecificGameConfig<TGame>;
}

export function GetScoreMetrics(
	gameConfig: GameConfig,
	type?: Array<ConfScoreMetric["type"]> | ConfScoreMetric["type"],
) {
	let metrics = [
		...Object.entries(gameConfig.providedMetrics),
		...Object.entries(gameConfig.derivedMetrics),
	];

	if (Array.isArray(type)) {
		metrics = metrics.filter(([_key, conf]) => type.includes(conf.type));
	} else if (type) {
		metrics = metrics.filter(([_key, conf]) => conf.type === type);
	}

	return metrics.map((e) => e[0]);
}

export function GetScoreEnumConfs(gameConfig: GameConfig) {
	const scoreMetrics = {
		...gameConfig.providedMetrics,
		...gameConfig.derivedMetrics,
	};

	const enumMetrics: Record<string, ConfEnumScoreMetric<string>> = {};

	for (const [key, value] of Object.entries(scoreMetrics)) {
		if (value.type === "ENUM") {
			enumMetrics[key] = value;
		}
	}

	return enumMetrics;
}

/**
 * Given a name for a metric and a value, check whether its sensible for
 * this game or not.
 *
 * @returns A string on failure, true on success.
 *
 * @note GRAPH and NULLABLE_GRAPH types are never valid here.
 */
export function ValidateMetric(gameConfig: GameConfig, metricName: string, metricValue: number) {
	const scoreMetrics = GetScoreMetrics(gameConfig, ["DECIMAL", "INTEGER", "ENUM"]);

	const conf = gameConfig.providedMetrics[metricName] ?? gameConfig.derivedMetrics[metricName];

	if (!conf || !scoreMetrics.includes(metricName)) {
		return `Invalid metric ${metricName}, Expected any of ${scoreMetrics.join(", ")}.`;
	}

	if (conf.type === "ENUM") {
		return p.isBoundedInteger(0, conf.values.length - 1)(metricValue);
	}

	if (conf.type === "GRAPH" || conf.type === "NULLABLE_GRAPH") {
		return "Cannot validate a graph or nullable graph metric.";
	}

	if (conf.chartDependentMax === true) {
		return `This metric is chart dependent and not appropriate to check in this context.`;
	}

	return conf.validate(metricValue);
}

export function GetScoreMetricConf(gameConfig: GameConfig, metric: string) {
	return gameConfig.providedMetrics[metric] ?? gameConfig.derivedMetrics[metric];
}

/**
 * Returns the rating algorithm config for a `scoreRatingAlgs` key, or `undefined`
 * if no such algorithm exists for this game.
 */
export function GetScoreRatingAlgConf(
	gameConfig: GameConfig,
	key: string,
): ScoreRatingAlgorithmConfig | undefined {
	return gameConfig.scoreRatingAlgs[key];
}
