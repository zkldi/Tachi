import Activity from "#components/activity/Activity";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { type GameProps } from "#types/react";
import { FormatGame, GameToGameGroup, GetGameGroupConfig } from "tachi-common";

export default function GameMainPage({ game }: GameProps) {
	useSetSubheader(
		["Games", GetGameGroupConfig(GameToGameGroup(game)).name],
		[game],
		FormatGame(game),
	);

	return <Activity url={`/games/${game}/activity`} />;
}
