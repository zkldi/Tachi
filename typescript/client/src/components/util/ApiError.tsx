import { UserSettingsContext } from "#context/UserSettingsContext";
import { type UnsuccessfulAPIFetchResponse } from "#util/api";
import React, { useContext } from "react";

export default function ApiError({ error }: { error: UnsuccessfulAPIFetchResponse }) {
	const { settings } = useContext(UserSettingsContext);

	return (
		<div>
			An error has occurred
			{settings?.preferences.developerMode
				? ` (${error.description ?? "Failed to reach server."})`
				: ""}
		</div>
	);
}
