import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function GitadoraJudgementCell({
	score,
}: {
	score:
		| PBScoreDocument<"gitadora-dora" | "gitadora-gita">
		| ScoreDocument<"gitadora-dora" | "gitadora-gita">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements.perfect) ||
		IsNullish(judgements.great) ||
		IsNullish(judgements.good) ||
		IsNullish(judgements.ok) ||
		IsNullish(judgements.miss)
	) {
		return <td>No Data.</td>;
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.gold }}>{judgements.perfect}</span>-
				<span style={{ color: COLOUR_SET.green }}>{judgements.great}</span>-
				<span style={{ color: COLOUR_SET.blue }}>{judgements.good}</span>-
				<span style={{ color: COLOUR_SET.purple }}>{judgements.ok}</span>-
				<span style={{ color: COLOUR_SET.red }}>{judgements.miss}</span>
			</strong>
		</td>
	);
}
