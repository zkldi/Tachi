import { p } from "prudence";

import type {
	GameConfig,
	GameGroup,
	GameGroupConfig,
	LEGACY_GPTString,
	LEGACY_Playtype,
	LEGACY_Playtypes,
	SpecificGameConfig,
	V3Game,
} from "../types/game-config";
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
 * Given a game and playtype, combine them into a GPTString.
 */
export function LEGACY_GetGPTString(game: GameGroup, playtype: LEGACY_Playtype): LEGACY_GPTString {
	return `${game}:${playtype}` as LEGACY_GPTString;
}

export function LEGACY_SplitGPT(gpt: LEGACY_GPTString) {
	return gpt.split(":") as [GameGroup, LEGACY_Playtype];
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

const v3GameMappings: Record<LEGACY_GPTString, V3Game> = {
	"iidx:SP": "iidx-sp",
	"iidx:DP": "iidx-dp",
	"museca:Single": "museca",
	"sdvx:Single": "sdvx",
	"bms:14K": "bms-14k",
	"bms:7K": "bms-7k",
	"gitadora:Dora": "gitadora-dora",
	"gitadora:Gita": "gitadora-gita",
	"chunithm:Single": "chunithm",
	"wacca:Single": "wacca",
	"jubeat:Single": "jubeat",
	"popn:9B": "popn",
	"maimai:Single": "maimai",
	"maimaidx:Single": "maimaidx",
	"pms:Controller": "pms-controller",
	"pms:Keyboard": "pms-keyboard",
	"usc:Controller": "usc-controller",
	"usc:Keyboard": "usc-keyboard",
	"itg:Stamina": "itg-stamina",
	"arcaea:Touch": "arcaea",
	"ongeki:Single": "ongeki",
	"ddr:SP": "ddr-sp",
	"ddr:DP": "ddr-dp",
};

/**
 * @deprecated
 */
export function LEGACY_GameGroupPTToGame(game: GameGroup, playtype: LEGACY_Playtype): V3Game {
	return LEGACY_GPTStringToGame(LEGACY_GetGPTString(game, playtype));
}

/**
 * @deprecated
 */
export function LEGACY_GPTStringToGame(gptString: LEGACY_GPTString): V3Game {
	return v3GameMappings[gptString];
}

/**
 * @deprecated
 */
export function LEGACY_GameToGPTString(game: V3Game): LEGACY_GPTString {
	const mapping: Record<V3Game, LEGACY_GPTString> = {
		"iidx-sp": "iidx:SP",
		"iidx-dp": "iidx:DP",
		museca: "museca:Single",
		sdvx: "sdvx:Single",
		"bms-14k": "bms:14K",
		"bms-7k": "bms:7K",
		"gitadora-dora": "gitadora:Dora",
		"gitadora-gita": "gitadora:Gita",
		chunithm: "chunithm:Single",
		wacca: "wacca:Single",
		jubeat: "jubeat:Single",
		popn: "popn:9B",
		maimai: "maimai:Single",
		maimaidx: "maimaidx:Single",
		"pms-controller": "pms:Controller",
		"pms-keyboard": "pms:Keyboard",
		"usc-controller": "usc:Controller",
		"usc-keyboard": "usc:Keyboard",
		"itg-stamina": "itg:Stamina",
		arcaea: "arcaea:Touch",
		ongeki: "ongeki:Single",
		"ddr-dp": "ddr:DP",
		"ddr-sp": "ddr:SP",
	};

	return mapping[game];
}

export const allSupportedGameGroups = Object.keys(GAME_GROUP_CONFIGS) as Array<GameGroup>;

/** V3 games in game-group order (matches each group's `games` array, e.g. BMS 7K before 14K). */
export const ALL_GAMES = allSupportedGameGroups.flatMap(
	(group) => GetGameGroupConfig(group).games,
) as Array<V3Game>;

export function GameToGameGroup(game: V3Game): GameGroup {
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

export function LEGACY_GameToGameGroupPT(v3Game: V3Game): {
	gameGroup: GameGroup;
	playtype: LEGACY_Playtype;
} {
	const gptString = LEGACY_GameToGPTString(v3Game);
	const [gameGroup, playtype] = LEGACY_SplitGPT(gptString);
	return { gameGroup, playtype };
}

export function LEGACY_GameToPlaytypeFn(v3Game: V3Game): LEGACY_Playtype {
	return LEGACY_GameToGameGroupPT(v3Game).playtype;
}

/**
 * Returns the configuration for this Game + Playtype. The type here is expanded to
 * its most generic form, for easiest interaction.
 */
export function LEGACY_GetGamePTConfig(
	gameGroup: GameGroup,
	playtype: LEGACY_Playtypes[GameGroup],
): GameConfig {
	const game = LEGACY_GameGroupPTToGame(gameGroup, playtype);

	return GAME_CONFIGS[game] as unknown as GameConfig;
}

export function LEGACY_GetGPTConfig(gptString: LEGACY_GPTString): GameConfig {
	const game = LEGACY_GPTStringToGame(gptString);
	return GAME_CONFIGS[game] as unknown as GameConfig;
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
 * Returns the configuration for this specific Game + Playtype. This type is narrowed
 * down to its least generic form, and is instead for gpt-specific use cases.
 */
export function GetSpecificGameConfig<TGame extends V3Game>(game: TGame) {
	return GAME_CONFIGS[game] as unknown as SpecificGameConfig<TGame>;
}

export const allGPTStrings = Object.keys(GAME_CONFIGS) as Array<LEGACY_GPTString>;

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
