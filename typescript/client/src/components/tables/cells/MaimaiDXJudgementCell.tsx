import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function MaimaiDXJudgementCell({
	score,
}: {
	score: PBScoreDocument<"maimaidx"> | ScoreDocument<"maimaidx">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements.miss) ||
		IsNullish(judgements.great) ||
		IsNullish(judgements.good) ||
		IsNullish(judgements.pcrit) ||
		IsNullish(judgements.perfect)
	) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.vibrantYellow }}>{judgements.pcrit}</span>-
				<span style={{ color: COLOUR_SET.orange }}>{judgements.perfect}</span>-
				<span style={{ color: COLOUR_SET.pink }}>{judgements.great}</span>-
				<span style={{ color: COLOUR_SET.green }}>{judgements.good}</span>-
				<span style={{ color: COLOUR_SET.gray }}>{judgements.miss}</span>
			</strong>
		</td>
	);
}
