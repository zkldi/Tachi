import { ChangeOpacity } from "#util/color-opacity";
import { COLOUR_SET } from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

export default function OngekiLampCell({
	noteLamp,
	bellLamp,
	colour,
}: {
	bellLamp: "FULL BELL" | "NONE";
	colour: string;
	noteLamp: "ALL BREAK" | "ALL BREAK+" | "CLEAR" | "FULL COMBO" | "LOSS";
}) {
	let content: React.ReactNode = (
		<div className={truncLine} style={{ minWidth: 0 }}>
			{noteLamp}
		</div>
	);
	let title: string = noteLamp;

	if (bellLamp !== "NONE") {
		if (noteLamp === "CLEAR") {
			title = bellLamp;
			content = (
				<div className={truncLine} style={{ minWidth: 0 }}>
					{bellLamp}
				</div>
			);
		} else {
			title = `${noteLamp} · ${bellLamp}`;
			content = (
				<span>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{noteLamp}
					</div>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{bellLamp}
					</div>
				</span>
			);
		}
	}

	const low = ChangeOpacity(colour, 0.2);
	const lowCorner = ChangeOpacity(COLOUR_SET.gold, 0.4);

	return (
		<td
			style={{
				...constrainedLampTdStyle,
				background:
					bellLamp === "FULL BELL"
						? `linear-gradient(-45deg, ${lowCorner} 0%,${lowCorner} 12%,${low} 12%,${low} 100%)`
						: low,
			}}
			title={title}
		>
			<strong>{content}</strong>
		</td>
	);
}
