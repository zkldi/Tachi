import { ChangeOpacity } from "#util/color-opacity";
import { FormatMillions } from "#util/misc";
import { type integer } from "tachi-common";

export default function MillionsScoreCell({
	score,
	colour,
	grade,
}: {
	colour: string;
	grade: string;
	score: integer;
}) {
	return (
		<td
			style={{
				backgroundColor: ChangeOpacity(colour, 0.2),
			}}
		>
			<strong>{grade}</strong>
			<br />
			{FormatMillions(score)}
		</td>
	);
}
