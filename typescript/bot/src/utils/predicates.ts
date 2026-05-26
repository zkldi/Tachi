import { GAME_GROUP_CONFIGS, type GameGroup } from "tachi-common";

/**
 * Determines whether an input is a record or not.
 */
export function IsRecord<T = string>(v: unknown): v is Record<string, T> {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** True if `key` is a known Tachi game group identifier (e.g. `iidx`, `sdvx`). */
export function IsGameGroupKey(key: string): key is GameGroup {
	return Object.prototype.hasOwnProperty.call(GAME_GROUP_CONFIGS, key);
}
