import { UserGameContext } from "#context/UserGameContext";
import { useContext } from "react";
import { type UserGameSettingsDocument, type V3Game } from "tachi-common";

export default function useLoggedInUserGameSettings<TGame extends V3Game = V3Game>() {
	const { loggedInData, setLoggedInData } = useContext(UserGameContext);

	const settings = (loggedInData?.settings ?? null) as UserGameSettingsDocument<TGame> | null;

	const setSettings = (newSettings: UserGameSettingsDocument<TGame>) => {
		if (!loggedInData) {
			throw new Error(`Tried to set settings while nobody was logged in?`);
		}

		setLoggedInData({
			...loggedInData,
			settings: newSettings,
		});
	};

	return { settings, setSettings };
}
