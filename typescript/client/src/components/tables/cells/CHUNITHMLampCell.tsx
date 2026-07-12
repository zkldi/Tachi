import { ChangeOpacity } from "#util/color-opacity";
import { type GetEnumValue } from "tachi-common/types/metrics";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

export default function CHUNITHMLampCell({
	noteLamp,
	clearLamp,
	noteLampColour,
	clearLampColour,
}: {
	clearLamp: GetEnumValue<"chunithm", "clearLamp">;
	clearLampColour: string;
	noteLamp: GetEnumValue<"chunithm", "noteLamp">;
	noteLampColour: string;
}) {
	let content: React.ReactNode = (
		<div className={truncLine} style={{ minWidth: 0 }}>
			{clearLamp}
		</div>
	);
	let background = ChangeOpacity(clearLampColour, 0.2);
	let title: string = clearLamp;

	if (noteLamp !== "NONE") {
		background = ChangeOpacity(noteLampColour, 0.2);

		if (clearLamp === "CLEAR") {
			title = `${noteLamp}`;
			content = (
				<div className={truncLine} style={{ minWidth: 0 }}>
					{noteLamp}
				</div>
			);
		} else {
			const clearLampLow = ChangeOpacity(clearLampColour, 0.2);
			const noteLampLow = ChangeOpacity(noteLampColour, 0.2);

			background = `linear-gradient(-45deg, ${clearLampLow} 0%, ${clearLampLow} 12%, ${noteLampLow} 12%, ${noteLampLow} 100%)`;

			title = `${noteLamp} · ${clearLamp}`;
			content = (
				<span>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{noteLamp}
					</div>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{clearLamp}
					</div>
				</span>
			);
		}
	}

	return (
		<td
			style={{
				...constrainedLampTdStyle,
				background,
			}}
			title={title}
		>
			<strong>{content}</strong>
		</td>
	);
}
