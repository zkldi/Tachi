import { UserSettingsContext } from "#context/UserSettingsContext";
import { RFA } from "#util/misc";
import { loggedInSplashes, neutralSplashes } from "#util/splashes";
import { useContext } from "react";

export default function useSplashText() {
	const { settings } = useContext(UserSettingsContext);

	let set = [];

	if (!settings) {
		set = neutralSplashes;
	} else {
		set = neutralSplashes.concat(loggedInSplashes);
	}

	return RFA(set);
}
