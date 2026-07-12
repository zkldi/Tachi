import { WindowContext } from "#context/WindowContext";
import { TACHI_LINE_THEME } from "#util/constants/chart-theme";
import { ResponsiveLine, type Serie } from "@nivo/line";
import React, { useContext } from "react";
import { COLOUR_SET } from "tachi-common";

import ChartTooltip from "./ChartTooltip";

export default function ITGDensityChart({
	width = "100%",
	height = "100%",
	mobileHeight = "100%",
	mobileWidth = width,
	data,
}: {
	data: Serie[];
	height?: number | string;
	mobileHeight?: number | string;
	mobileWidth?: number | string;
	width?: number | string;
} & ResponsiveLine["props"]) {
	const {
		breakpoint: { isMd },
	} = useContext(WindowContext);
	return (
		<div style={{ height: isMd ? height : mobileHeight, width: isMd ? width : mobileWidth }}>
			<ResponsiveLine
				axisLeft={{ format: (y) => `${npsToBPM(y)}BPM` }}
				colors={COLOUR_SET.purple}
				crosshairType="x"
				curve="stepAfter"
				data={data}
				enableArea
				enableGridX={false}
				enablePoints={false}
				legends={[]}
				margin={{ top: 30, bottom: 50, left: 90, right: 50 }}
				motionConfig="stiff"
				theme={TACHI_LINE_THEME}
				tooltip={(d) => (
					<ChartTooltip>
						Measure {d.point.data.xFormatted}:{" "}
						{npsToBPM(Number(d.point.data.yFormatted)).toFixed()}
						BPM
					</ChartTooltip>
				)}
				useMesh={true}
				xScale={{ type: "linear" }}
				yScale={{ type: "linear" }}
			/>
		</div>
	);
}

// Always assume 4/4 time. I know it sucks, but stepmania does the same.
function npsToBPM(nps: number) {
	return (nps * 60) / 4;
}

function _bpmToNPS(bpm: number) {
	return (bpm * 4) / 60;
}
