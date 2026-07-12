import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function MusecaJudgementCell({
	score,
}: {
	score: PBScoreDocument<"museca"> | ScoreDocument<"museca">;
}) {
	// even if we dont have judgement data, we know what they got.
	if (score.scoreData.lamp === "PERFECT CONNECT ALL") {
		return (
			<td>
				<strong>
					<span style={{ color: COLOUR_SET.teal }}>0</span>-
					<span style={{ color: COLOUR_SET.red }}>0</span>
				</strong>
			</td>
		);
	}

	const judgements = score.scoreData.judgements;

	if (IsNullish(judgements.miss) || IsNullish(judgements.near)) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.teal }}>{judgements.near}</span>-
				<span style={{ color: COLOUR_SET.red }}>{judgements.miss}</span>
			</strong>
		</td>
	);
}
