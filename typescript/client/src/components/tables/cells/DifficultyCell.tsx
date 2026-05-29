import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import React from "react";
import {
	type ChartDocument,
	FormatDifficultyLong,
	FormatDifficultyShort,
	type V3Game,
} from "tachi-common";

import BMSOrPMSDifficultyCell from "./BMSOrPMSDifficultyCell";
import { DIFFICULTY_CELL_WIDTH_PX } from "./difficulty-cell-layout";
import ITGDifficultyCell from "./ITGDifficultyCell";
import RatingSystemPart from "./RatingSystemPart";
import USCDifficultyCell from "./USCDifficultyCell";

type BMSGames = "bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard";

const truncLineCls = "d-block text-truncate";

export default function DifficultyCell({
	game,
	chart,
	alwaysShort,
	noTierlist,
}: {
	alwaysShort?: boolean;
	chart: ChartDocument;
	game: V3Game;
	noTierlist?: boolean;
}) {
	if (
		game === "bms-7k" ||
		game === "bms-14k" ||
		game === "pms-controller" ||
		game === "pms-keyboard"
	) {
		return <BMSOrPMSDifficultyCell chart={chart as ChartDocument<BMSGames>} game={game} />;
	} else if (game === "usc-controller" || game === "usc-keyboard") {
		return (
			<USCDifficultyCell chart={chart as ChartDocument<"usc-controller" | "usc-keyboard">} />
		);
	} else if (game === "itg-stamina") {
		return <ITGDifficultyCell chart={chart as ChartDocument<"itg-stamina">} />;
	}

	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	if (["iidx-dp", "iidx-sp", "maimaidx", "ongeki"].includes(game)) {
		alwaysShort = true;
	}

	const difficultyCellWidthPx =
		// EXHC makes it too long...
		game === "iidx-sp" || game === "iidx-dp"
			? DIFFICULTY_CELL_WIDTH_PX + 16
			: DIFFICULTY_CELL_WIDTH_PX;

	const nativeTitleTooltip = [FormatDifficultyLong(chart), chart.level]
		.filter(Boolean)
		.join(" — ");

	return (
		<td
			style={{
				boxSizing: "border-box",
				minWidth: 0,
				// @ts-expect-error yawn
				backgroundColor: ChangeOpacity(gptImpl.difficultyColours[chart.difficulty]!, 0.2),
				maxWidth: `${difficultyCellWidthPx}px`,
				overflow: "hidden",
				width: `${difficultyCellWidthPx}px`,
			}}
			title={nativeTitleTooltip}
		>
			{!alwaysShort && (
				<div className="d-none d-lg-block">
					<span className={truncLineCls} style={{ minWidth: 0 }}>
						{FormatDifficultyLong(chart)}
					</span>
				</div>
			)}
			<div className={!alwaysShort ? "d-lg-none" : undefined}>
				<span className={truncLineCls} style={{ minWidth: 0 }}>
					{FormatDifficultyShort(chart)}
				</span>
			</div>
			<div className={truncLineCls} style={{ minWidth: 0 }}>
				<DisplayLevelNum game={game} level={chart.level} levelNum={chart.levelNum} />
			</div>
			{!noTierlist && gptImpl.ratingSystems.length > 0 && (
				<RatingSystemPart chart={chart} game={game} truncateRatingsLines />
			)}
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

export function DisplayLevelNum({
	level,
	levelNum,
	prefix,
	game,
}: {
	game: V3Game;
	level: string;
	levelNum: number;
	prefix?: string;
}) {
	if (game === "chunithm" && level === "" && levelNum === 0) {
		return null;
	}

	if (game === "ongeki" && level === "0") {
		return null;
	}

	if (["arcaea", "chunithm", "maimai", "maimaidx", "ongeki", "wacca"].includes(game)) {
		return (
			<Muted>
				{prefix}
				{levelNum.toFixed(1)}
			</Muted>
		);
	}

	if (levelNum.toString() === level || level.endsWith(".0") || levelNum === 0) {
		return null;
	}

	if (game === "gitadora-gita" || game === "gitadora-dora") {
		return null;
	}

	return (
		<Muted>
			{prefix}
			{levelNum.toString()}
		</Muted>
	);
}
