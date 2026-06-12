import { IsNotNullish, IsNullish } from "#util/misc";
import { COLOUR_SET, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function ITGJudgementCell({
	score,
}: {
	score: PBScoreDocument<"itg-stamina"> | ScoreDocument<"itg-stamina">;
}) {
	const judgements = score.scoreData.judgements;

	if (
		IsNullish(judgements["fantastic+"]) ||
		IsNullish(judgements.fantastic) ||
		IsNullish(judgements.excellent) ||
		IsNullish(judgements.great) ||
		IsNullish(judgements.miss)
	) {
		return <td>No Data.</td>;
	}

	let cbs = judgements.miss!;
	let cbString = cbs.toString();

	if (IsNotNullish(judgements.decent)) {
		cbs += judgements.decent!;
	}

	if (IsNotNullish(judgements.wayoff)) {
		cbs += judgements.wayoff!;
	}

	if (IsNullish(judgements.decent) || IsNullish(judgements.wayoff)) {
		cbString += "*";
	}

	return (
		<td>
			<strong>
				<span style={{ color: COLOUR_SET.teal }}>{judgements["fantastic+"]}</span>-
				<span style={{ color: COLOUR_SET.white }}>{judgements.fantastic}</span>-
				<span style={{ color: COLOUR_SET.gold }}>{judgements.excellent}</span>-
				<span style={{ color: COLOUR_SET.green }}>{judgements.great}</span>-
				<span style={{ color: COLOUR_SET.red }}>{cbString}cb</span>
			</strong>
		</td>
	);
}
