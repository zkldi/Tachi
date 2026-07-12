import { GetGameConfig, type V3Game } from "tachi-common";

import useLoggedInUserGameSettings from "./useLoggedInUserGameSettings";

export function useBucket(game: V3Game) {
	const { settings } = useLoggedInUserGameSettings();

	if (!settings?.preferences.preferredDefaultEnum) {
		const gameConfig = GetGameConfig(game);

		return gameConfig.preferredDefaultEnum;
	}

	return settings.preferences.preferredDefaultEnum;
}
