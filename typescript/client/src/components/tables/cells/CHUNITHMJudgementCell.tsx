import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function CHUNITHMJudgementCell({
	score,
}: {
	score: PBScoreDocument<"chunithm"> | ScoreDocument<"chunithm">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements.miss) ||
		IsNullish(judgements.attack) ||
		IsNullish(judgements.justice) ||
		IsNullish(judgements.jcrit)
	) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.gold }}>{judgements.jcrit}</span>-
				<span style={{ color: COLOUR_SET.orange }}>{judgements.justice}</span>-
				<span style={{ color: COLOUR_SET.green }}>{judgements.attack}</span>-
				<span style={{ color: COLOUR_SET.gray }}>{judgements.miss}</span>
			</strong>
		</td>
	);
}
