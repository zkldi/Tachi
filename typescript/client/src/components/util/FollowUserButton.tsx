import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { APIFetchV1 } from "#util/api";
import React, { useContext } from "react";
import { Button } from "react-bootstrap";
import { type UserDocument } from "tachi-common";

export default function FollowUserButton({ userToFollow }: { userToFollow: UserDocument }) {
	const { settings: userSettings, setSettings: setUserSettings } =
		useContext(UserSettingsContext);

	if (!userSettings) {
		return null;
	}

	// can't follow yourself
	if (userSettings.userID === userToFollow.id) {
		return null;
	}

	if (userSettings.following.includes(userToFollow.id)) {
		return (
			<Button
				onClick={async () => {
					const res = await APIFetchV1(
						`/users/${userSettings.userID}/following/remove`,
						{
							method: "POST",
							body: JSON.stringify({
								userID: userToFollow.id,
							}),
							headers: {
								"Content-Type": "application/json",
							},
						},
						true,
						true,
					);

					if (res.success) {
						const newFollowing = userSettings.following.filter(
							(e) => e !== userToFollow.id,
						);

						setUserSettings({
							...userSettings,
							following: newFollowing,
						});
					}
				}}
				variant="outline-danger"
			>
				Unfollow
			</Button>
		);
	}

	return (
		<QuickTooltip tooltipContent="Following a user will mean you'll see their sessions and updates in your feed.">
			<Button
				onClick={async () => {
					const res = await APIFetchV1(
						`/users/${userSettings.userID}/following/add`,
						{
							method: "POST",
							body: JSON.stringify({
								userID: userToFollow.id,
							}),
							headers: {
								"Content-Type": "application/json",
							},
						},
						true,
						true,
					);

					if (res.success) {
						const newFollowing = [...userSettings.following, userToFollow.id];

						setUserSettings({
							...userSettings,
							following: newFollowing,
						});
					}
				}}
				variant="outline-success"
			>
				Follow
			</Button>
		</QuickTooltip>
	);
}
