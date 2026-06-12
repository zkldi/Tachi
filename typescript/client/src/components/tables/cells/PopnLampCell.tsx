import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

export default function PopnLampCell({
	score,
}: {
	score: PBScoreDocument<"popn"> | ScoreDocument<"popn">;
}) {
	const lamp = score.scoreData.lamp;
	return (
		<td
			style={{
				...constrainedLampTdStyle,
				backgroundColor: ChangeOpacity(
					GAME_CLIENT_IMPLEMENTATIONS.popn.enumColours.lamp[lamp],
					0.2,
				),
			}}
			title={lamp}
		>
			<div className="d-block text-truncate" style={{ minWidth: 0 }}>
				<strong>{lamp}</strong>
			</div>
		</td>
	);
}
