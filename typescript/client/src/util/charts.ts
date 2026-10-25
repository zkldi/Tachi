import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type ChartDocument } from "tachi-common";

import { TACHI_BAR_THEME } from "./constants/chart-theme";

export const DEFAULT_BAR_PROPS = {
	labelTextColor: "var(--bs-secondary-color)",
	labelSkipHeight: 12,
	labelSkipWidth: 30,
	theme: TACHI_BAR_THEME,
	motionConfig: "stiff",
};

export const GetChartColor = (chart: ChartDocument): string | undefined => {
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[chart.game];
	return (gptImpl.difficultyColours as { [key: string]: string })[chart.difficulty];
};
