import { GetEnumColour } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

// Lamp cell, but if the lamp is FAILED, display it slightly differently.
export default function SDVXLampCell({
	score,
}: {
	score:
		| PBScoreDocument<"sdvx" | "usc-controller" | "usc-keyboard">
		| ScoreDocument<"sdvx" | "usc-controller" | "usc-keyboard">;
}) {
	const displayLamp = score.scoreData.lamp === "FAILED" ? "PLAYED" : score.scoreData.lamp;
	return (
		<td
			style={{
				...constrainedLampTdStyle,
				backgroundColor: ChangeOpacity(GetEnumColour(score, "lamp"), 0.2),
			}}
			title={displayLamp}
		>
			<div className="d-block text-truncate" style={{ minWidth: 0 }}>
				<strong>{displayLamp}</strong>
			</div>
		</td>
	);
}
