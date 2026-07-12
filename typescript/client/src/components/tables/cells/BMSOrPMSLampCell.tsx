import { GetEnumColour } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { IsNotNullish } from "#util/misc";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

type BMSGames = "bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard";

export default function BMSOrPMSLampCell({
	score,
}: {
	score: PBScoreDocument<BMSGames> | ScoreDocument<BMSGames>;
}) {
	const bpPart = IsNotNullish(score.scoreData.optional.bp)
		? `[BP: ${score.scoreData.optional.bp}]`
		: null;
	const titleTooltip = bpPart ? `${score.scoreData.lamp} ${bpPart}` : score.scoreData.lamp;

	return (
		<td
			style={{
				...constrainedLampTdStyle,
				backgroundColor: ChangeOpacity(GetEnumColour(score, "lamp"), 0.2),
			}}
			title={titleTooltip}
		>
			<div className={truncLine} style={{ minWidth: 0 }}>
				<strong>{score.scoreData.lamp}</strong>
			</div>
			{bpPart && (
				<small className={truncLine} style={{ minWidth: 0 }}>
					{bpPart}
				</small>
			)}
		</td>
	);
}
