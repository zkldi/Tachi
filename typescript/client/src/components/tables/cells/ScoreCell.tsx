import { ChangeOpacity } from "#util/color-opacity";
import { ToFixedFloor } from "#util/misc";
import { type integer } from "tachi-common";

export default function ScoreCell({
	score,
	colour,
	grade,
	percent,
	percentDp = 2,
	scoreRenderFn,
}: {
	colour: string;
	grade: string;
	percent: number;
	percentDp?: integer;
	score?: integer;
	scoreRenderFn?: (s: number) => string;
	showScore?: boolean;
}) {
	return (
		<td
			style={{
				backgroundColor: ChangeOpacity(colour, 0.2),
			}}
		>
			<strong>{grade}</strong>
			<br />
			{`${ToFixedFloor(percent, percentDp)}%`}
			{score !== undefined && (
				<>
					<br />
					<small className="text-body-secondary">
						[{scoreRenderFn ? scoreRenderFn(score) : score}]
					</small>
				</>
			)}
		</td>
	);
}
