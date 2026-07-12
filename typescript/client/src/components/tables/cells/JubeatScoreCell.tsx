import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatMillions, ToFixedFloor } from "#util/misc";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function JubeatScoreCell({
	sc,
}: {
	sc: PBScoreDocument<"jubeat"> | ScoreDocument<"jubeat">;
}) {
	return (
		<td
			style={{
				backgroundColor: ChangeOpacity(
					GAME_CLIENT_IMPLEMENTATIONS.jubeat.enumColours.grade[sc.scoreData.grade],
					0.2,
				),
			}}
		>
			<strong>{sc.scoreData.grade}</strong>
			<br />
			<b>{ToFixedFloor(sc.scoreData.musicRate, 2)}%</b>
			<br />
			{FormatMillions(sc.scoreData.score)}
		</td>
	);
}
