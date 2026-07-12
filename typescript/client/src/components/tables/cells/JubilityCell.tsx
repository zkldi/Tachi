import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function JubilityCell({ score }: { score: PBScoreDocument | ScoreDocument }) {
	let color: string | undefined = undefined;

	const jubility = score.calculatedData.jubility;

	if (jubility === null || jubility === undefined) {
		color = undefined;
	} else if (jubility >= 158.3) {
		color = COLOUR_SET.gold;
	} else if (jubility >= 141.7) {
		color = COLOUR_SET.orange;
	} else if (jubility >= 116.7) {
		color = COLOUR_SET.pink;
	} else if (jubility >= 91.7) {
		color = COLOUR_SET.vibrantPurple;
	} else if (jubility >= 66.7) {
		color = COLOUR_SET.purple;
	} else if (jubility >= 41.7) {
		color = COLOUR_SET.blue;
	} else if (jubility >= 25.0) {
		color = COLOUR_SET.teal;
	} else if (jubility >= 12.5) {
		color = COLOUR_SET.green;
	} else if (jubility >= 4.2) {
		color = COLOUR_SET.darkGreen;
	}

	return (
		<td
			style={{
				color,
				outline: "white",
			}}
		>
			<strong>{score.calculatedData.jubility?.toFixed(1) ?? "N/A"}</strong>
		</td>
	);
}
