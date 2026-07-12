import {
	GetGameConfig,
	type ProfileRatingAlgorithms,
	type ScoreRatingAlgorithms,
	type SessionRatingAlgorithms,
	type V3Game,
} from "tachi-common";

import useLoggedInUserGameSettings from "./useLoggedInUserGameSettings";

export default function useScoreRatingAlg<TGame extends V3Game = V3Game>(
	game: TGame,
): ScoreRatingAlgorithms[TGame] {
	const { settings } = useLoggedInUserGameSettings();

	if (!settings?.preferences.preferredScoreAlg) {
		const gameConfig = GetGameConfig(game);

		return gameConfig.defaultScoreRatingAlg as ScoreRatingAlgorithms[TGame];
	}

	return settings.preferences.preferredScoreAlg as ScoreRatingAlgorithms[TGame];
}

export function useSessionRatingAlg<TGame extends V3Game = V3Game>(
	game: TGame,
): SessionRatingAlgorithms[TGame] {
	const { settings } = useLoggedInUserGameSettings();

	if (!settings?.preferences.preferredSessionAlg) {
		const gameConfig = GetGameConfig(game);

		return gameConfig.defaultSessionRatingAlg as SessionRatingAlgorithms[TGame];
	}

	return settings.preferences.preferredSessionAlg as SessionRatingAlgorithms[TGame];
}

export function useProfileRatingAlg<TGame extends V3Game = V3Game>(
	game: TGame,
): ProfileRatingAlgorithms[TGame] {
	const { settings } = useLoggedInUserGameSettings();

	if (!settings?.preferences.preferredProfileAlg) {
		const gameConfig = GetGameConfig(game);

		return gameConfig.defaultProfileRatingAlg as ProfileRatingAlgorithms[TGame];
	}

	return settings.preferences.preferredProfileAlg as ProfileRatingAlgorithms[TGame];
}
