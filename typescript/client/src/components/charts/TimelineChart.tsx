import { WindowContext } from "#context/WindowContext";
import { ColourConfig } from "#lib/config";
import { TACHI_LINE_THEME } from "#util/constants/chart-theme";
import { ResponsiveLine, type Serie } from "@nivo/line";
import React, { useContext, useMemo } from "react";

function isDefinedTimelineValue(value: unknown): value is number {
	return value !== undefined && value !== null && !Number.isNaN(Number(value));
}

function withDefinedTimelineValues(data: readonly Serie[]): Serie[] {
	return data.map((series) => ({
		...series,
		data: series.data.filter((point) => isDefinedTimelineValue(point.y)),
	}));
}

export default function TimelineChart({
	width = "100%",
	height = "100%",
	mobileHeight = "100%",
	mobileWidth = width,
	data,
	reverse,
	...props
}: {
	height?: number | string;
	mobileHeight?: number | string;
	mobileWidth?: number | string;
	reverse?: boolean;
	width?: number | string;
} & ResponsiveLine["props"]) {
	const {
		breakpoint: { isMd },
	} = useContext(WindowContext);
	const graphStyle = { height: isMd ? height : mobileHeight, width: isMd ? width : mobileWidth };
	const chartData = useMemo(() => withDefinedTimelineValues(data), [data]);
	const pointCount = chartData[0]?.data.length ?? 0;

	if (!chartData[0] || pointCount < 2) {
		return (
			<div className="d-flex justify-content-center align-items-center" style={graphStyle}>
				<div className="text-center">
					Not Enough Data... Yet.
					<br />
					<small className="text-body-secondary">
						(You need at least 2 days worth of data)
					</small>
				</div>
			</div>
		);
	}
	return (
		<div style={graphStyle}>
			<ResponsiveLine
				colors={[ColourConfig.primary]}
				crosshairType="x"
				data={chartData}
				enablePoints={false}
				gridXValues={3}
				legends={[]}
				margin={{ top: 40, bottom: 40, left: 60, right: 40 }}
				motionConfig="stiff"
				theme={TACHI_LINE_THEME}
				useMesh={true}
				xFormat="time:%Q"
				xScale={{ type: "time", format: "%Q" }}
				yScale={{ type: "linear", min: "auto", max: "auto", reverse }}
				{...props}
			/>
		</div>
	);
}
