import { UserSettingsContext } from "#context/UserSettingsContext";
import React, { useContext } from "react";

export default function HasDevModeOn({ children }: { children: React.ReactChild }) {
	const { settings } = useContext(UserSettingsContext);

	if (!settings?.preferences.developerMode) {
		return null;
	}

	return <>{children}</>;
}
