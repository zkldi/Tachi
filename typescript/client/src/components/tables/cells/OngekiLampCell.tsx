import { ChangeOpacity } from "#util/color-opacity";
import { COLOUR_SET } from "tachi-common";

import { constrainedLampTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

const shortMappings = {
	"ALL BREAK": "AB",
	"ALL BREAK+": "AB+",
	CLEAR: "CLR",
	"FULL COMBO": "FC",
	"FULL BELL": "FB",
	LOSS: "LOSS",
};

export default function OngekiLampCell({
	noteLamp,
	bellLamp,
	colour,
	mobile,
}: {
	bellLamp: "FULL BELL" | "NONE";
	colour: string;
	mobile: boolean;
	noteLamp: "ALL BREAK" | "ALL BREAK+" | "CLEAR" | "FULL COMBO" | "LOSS";
}) {
	let content: React.ReactNode = (
		<div className={truncLine} style={{ minWidth: 0 }}>
			{mobile ? shortMappings[noteLamp] : noteLamp}
		</div>
	);
	let title: string = noteLamp;

	if (bellLamp !== "NONE") {
		if (noteLamp === "CLEAR") {
			title = bellLamp;
			content = (
				<div className={truncLine} style={{ minWidth: 0 }}>
					{mobile ? shortMappings[bellLamp] : bellLamp}
				</div>
			);
		} else {
			title = `${noteLamp} · ${bellLamp}`;
			content = (
				<span>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{mobile ? shortMappings[noteLamp] : noteLamp}
					</div>
					<div className={truncLine} style={{ minWidth: 0 }}>
						{mobile ? shortMappings[bellLamp] : bellLamp}
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
