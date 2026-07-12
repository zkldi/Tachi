import Activity from "#components/activity/Activity";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { type GameProfileProps } from "#types/react";
import { Link } from "react-router-dom";

export default function RivalsActivityPage({ reqUser, game }: GameProfileProps) {
	const { settings } = useLoggedInUserGameSettings();

	if (!settings) {
		return <>You have no settings. How did you get here?</>;
	}

	if (settings.rivals.length === 0) {
		return (
			<div className="text-center">
				You have no rivals set.{" "}
				<Link to={`/u/${reqUser.id}/games/${game}/rivals/manage`}>Go set some!</Link>
			</div>
		);
	}

	return <Activity url={`/users/${reqUser.id}/games/${game}/rivals/activity`} />;
}
