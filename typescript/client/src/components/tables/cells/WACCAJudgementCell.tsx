import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function WaccaJudgementCell({
	score,
}: {
	score: PBScoreDocument<"wacca"> | ScoreDocument<"wacca">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements.miss) ||
		IsNullish(judgements.great) ||
		IsNullish(judgements.good) ||
		IsNullish(judgements.marvelous)
	) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.vibrantPink }}>{judgements.marvelous}</span>-
				<span style={{ color: COLOUR_SET.gold }}>{judgements.great}</span>-
				<span style={{ color: COLOUR_SET.blue }}>{judgements.good}</span>-
				<span style={{ color: COLOUR_SET.red }}>{judgements.miss}</span>
			</strong>
		</td>
	);
}
