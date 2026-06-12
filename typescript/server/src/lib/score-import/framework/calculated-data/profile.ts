import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { type GameProfileCalcs } from "#game-implementations/types";
import { type integer, type UserGameStats, type V3Game } from "tachi-common";

/**
 * Calculate profile ratings for this profile.
 */
export function CalculateProfileRatings(
	game: V3Game,
	userID: integer,
): Promise<UserGameStats["ratings"]> {
	const profileCalcs = GAME_IMPLEMENTATIONS[game].profileCalcs as GameProfileCalcs<V3Game>;

	return profileCalcs(game, userID);
}
