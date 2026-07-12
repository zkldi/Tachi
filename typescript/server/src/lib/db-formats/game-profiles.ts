import { type Selection } from "kysely";
import {
	type AnyClasses,
	type ProfileRatingAlgorithms,
	type UserGameStats,
	type V3Game,
} from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_GAME_PROFILE = [
	"game_profile.user_id",
	"game_profile.game",
	"game_profile.ratings",
	"game_profile.classes",
] as const;

export function ToGameStatsDocument(
	row: Selection<Database, "game_profile", (typeof SELECT_GAME_PROFILE)[number]>,
): UserGameStats {
	return {
		userID: row.user_id,
		game: row.game,
		ratings: row.ratings as Partial<Record<ProfileRatingAlgorithms[V3Game], number | null>>,
		classes: row.classes as AnyClasses,
	};
}
