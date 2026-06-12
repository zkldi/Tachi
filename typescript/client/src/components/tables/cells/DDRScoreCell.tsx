import { ChangeOpacity } from "#util/color-opacity";
import { type integer } from "tachi-common";

export default function DDRScoreCell({
	score,
	colour,
	grade,
	exScore,
	scoreRenderFn,
}: {
	colour: string;
	exScore?: integer;
	grade: string;
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
			{score !== undefined && <>{scoreRenderFn ? scoreRenderFn(score) : score}</>}
			{typeof exScore === "number" && (
				<>
					<br />
					[EX: {exScore}]
				</>
			)}
		</td>
	);
}
