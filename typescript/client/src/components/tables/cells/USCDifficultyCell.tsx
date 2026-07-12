import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Icon from "#components/util/Icon";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatTables } from "#util/misc";
import { type ChartDocument, COLOUR_SET } from "tachi-common";

import { DIFFICULTY_CELL_WIDTH_PX } from "./difficulty-cell-layout";
import RatingSystemPart from "./RatingSystemPart";

type USCGame = "usc-controller" | "usc-keyboard";

const truncLineCls = "d-block text-truncate";

export default function USCDifficultyCell({ chart }: { chart: ChartDocument<USCGame> }) {
	const game: USCGame = chart.game as USCGame;

	const levelText = chart.data.isOfficial
		? `${chart.difficulty} ${chart.level}`
		: FormatTables(chart.data.tableFolders);

	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	const bgColour = ChangeOpacity(
		chart.data.isOfficial ? gptImpl.difficultyColours[chart.difficulty]! : COLOUR_SET.teal,
		0.2,
	);

	return (
		<td
			style={{
				backgroundColor: bgColour,
				boxSizing: "border-box",
				maxWidth: `${DIFFICULTY_CELL_WIDTH_PX}px`,
				minWidth: 0,
				overflow: "hidden",
				width: `${DIFFICULTY_CELL_WIDTH_PX}px`,
			}}
			title={levelText}
		>
			<span className={truncLineCls} style={{ minWidth: 0 }}>
				{levelText}
			</span>
			<RatingSystemPart chart={chart} game={game} truncateRatingsLines />
			{!chart.isPrimary && (
				<QuickTooltip tooltipContent="This chart is an alternate, old chart.">
					<div>
						<Icon type="exclamation-triangle" />
					</div>
				</QuickTooltip>
			)}
		</td>
	);
}
