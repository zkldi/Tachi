import { IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function OngekiJudgementCell({
	score,
	mobile,
}: {
	mobile: boolean;
	score: PBScoreDocument<"ongeki"> | ScoreDocument<"ongeki">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements.miss) ||
		IsNullish(judgements.hit) ||
		IsNullish(judgements.break) ||
		IsNullish(judgements.cbreak)
	) {
		return <td>No Data.</td>;
	}

	return (
		<td style={{ verticalAlign: "middle" }}>
			<strong>
				<div>
					<span style={{ color: COLOUR_SET.gold }}>{judgements.cbreak}</span>-
					<span style={{ color: COLOUR_SET.orange }}>{judgements.break}</span>-
					<span style={{ color: COLOUR_SET.vibrantBlue }}>{judgements.hit}</span>-
					<span style={{ color: COLOUR_SET.gray }}>{judgements.miss}</span>
				</div>
				<div style={{ color: COLOUR_SET.vibrantYellow }}>
					{score.scoreData.optional.bellCount ?? "?"}/
					{score.scoreData.optional.totalBellCount ?? "?"}
					{mobile && (
						<span style={{ color: COLOUR_SET.red }}>
							&nbsp;&nbsp;{score.scoreData.optional.damage ?? "?"}
						</span>
					)}
				</div>
			</strong>
		</td>
	);
}
