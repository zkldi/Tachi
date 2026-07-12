import { type UserGameSettingsDocument } from "tachi-common";

import useLoggedInUserGameSettings from "./useLoggedInUserGameSettings";

export default function usePreferredRanking():
	| UserGameSettingsDocument["preferences"]["preferredRanking"]
	| null {
	const { settings } = useLoggedInUserGameSettings();

	const raw = settings?.preferences.preferredRanking ?? null;
	// Rival ranking display is disabled; treat stored preference as global.
	return raw === "rival" ? "global" : raw;
}
