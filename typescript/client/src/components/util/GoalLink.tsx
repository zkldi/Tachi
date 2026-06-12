import { Link } from "react-router-dom";
import { type GoalDocument } from "tachi-common";

import useLoggedInUserGameSettings from "./useLoggedInUserGameSettings";

export default function GoalLink({ goal, noPad }: { goal: GoalDocument; noPad?: boolean }) {
	const { settings } = useLoggedInUserGameSettings();

	const pad = noPad ? "" : "ms-2";
	const v3Game = goal.game;

	switch (goal.charts.type) {
		case "multi":
			return <span className={pad}>{goal.name}</span>;
		case "single":
			return (
				<Link
					className={`text-decoration-none ${pad}`}
					to={`/games/${v3Game}/charts/${goal.charts.data}`}
				>
					{goal.name}
				</Link>
			);

		case "folder": {
			if (!settings) {
				return <span className={pad}>{goal.name}</span>;
			}
			const folderPath =
				"folderSlug" in goal.charts && goal.charts.folderSlug !== undefined
					? goal.charts.folderSlug
					: goal.charts.data;
			return (
				<Link
					className={`text-decoration-none ${pad}`}
					to={`/u/${settings.userID}/games/${v3Game}/folders/${folderPath}`}
				>
					{goal.name}
				</Link>
			);
		}
	}
}
