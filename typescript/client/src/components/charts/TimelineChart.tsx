import { WindowContext } from "#context/WindowContext";
import { ColourConfig } from "#lib/config";
import { TACHI_LINE_THEME } from "#util/constants/chart-theme";
import { ResponsiveLine } from "@nivo/line";
import React, { useContext } from "react";

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
	if (!data[0] || data[0].data.length < 2) {
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
				data={data}
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
