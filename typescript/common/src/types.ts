import type { GameGroup } from "./types/game-config";
import type { ImportTypes } from "./types/import-types";

/**
 * An alias for number, that makes part of the code self-documenting.
 * Note that if it were possible to enforce integer-y ness, then I would absolutely do so here
 * but I can not.
 */
export type integer = number;

export enum UserAuthLevels {
	ADMIN = 3,
	BANNED = 0,
	USER = 1,
}

/**
 * The config the server expects, and emits on /api/v1/config.
 */
export interface TachiServerCoreConfig {
	GAME_GROUPS: Array<GameGroup>;
	IMPORT_TYPES: Array<ImportTypes>;
	NAME: string;
	TYPE: "boku" | "kamai" | "omni";
	SIGNUPS_ENABLED: boolean;
	/** True when the server is configured for community quest proposals (GitHub App). */
	QUEST_PROPOSALS_ENABLED: boolean;
}

export * from "./types/api";
export * from "./types/batch-manual";
export * from "./types/documents";
export * from "./types/game-config";
export * from "./types/import-types";
export * from "./types/notifications";
export * from "./types/seeds-documents";
