import { ChangeOpacity } from "#util/color-opacity";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

export default function LampCell({ lamp, colour }: { colour: string; lamp: string }) {
	return (
		<td
			style={{
				...constrainedLampTdStyle,
				backgroundColor: ChangeOpacity(colour, 0.2),
			}}
			title={lamp}
		>
			<div className="d-block text-truncate" style={{ minWidth: 0 }}>
				<strong>{lamp}</strong>
			</div>
		</td>
	);
}
