import type { ExtractedClasses, UserGameStats, V3Game } from "tachi-common";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";

export function CalculateDerivedClasses<TGame extends V3Game>(
	game: TGame,
	profileRatings: UserGameStats["ratings"],
) {
	return GAME_IMPLEMENTATIONS[game].classDerivers(profileRatings) as Partial<
		ExtractedClasses[TGame]
	>;
}
