import { TACHI_LINE_THEME } from "#util/constants/chart-theme";
import { ResponsiveLine, type Serie } from "@nivo/line";
import { COLOUR_SET } from "tachi-common";

import ChartTooltip from "./ChartTooltip";

const yAxes = {
	Easy: [22, 60, 80, 100],
	Normal: [22, 60, 80, 100],
	Hard: [30, 50, 100],
	DAN_GAUGE: [30, 50, 100],
	EXHard: [30, 50, 100],
};

const colours = {
	DAN_GAUGE: COLOUR_SET.gray,
	Easy: [COLOUR_SET.green, COLOUR_SET.vibrantRed],
	Normal: [COLOUR_SET.blue, COLOUR_SET.vibrantRed],
	Hard: COLOUR_SET.vibrantRed,
	EXHard: COLOUR_SET.gold,
};

export default function IIDXLampChart({
	width = "100%",
	height = "100%",
	mobileHeight = "100%",
	mobileWidth = width,
	type,
	data,
	usePercentXAxis = false,
}: {
	data: Serie[];
	height?: number | string;
	mobileHeight?: number | string;
	mobileWidth?: number | string;
	type: "DAN_GAUGE" | "Easy" | "EXHard" | "Hard" | "Normal";
	usePercentXAxis?: boolean;
	width?: number | string;
} & ResponsiveLine["props"]) {
	let realData = [];

	if (type === "Hard" || type === "EXHard" || type === "DAN_GAUGE") {
		realData = data;
	} else {
		const failSet = [];
		const clearSet = [];

		let lastLastWasFail = true;
		let lastWasFail = true;

		for (const d of data[0].data) {
			if (((d.y as number) ?? 0) >= 80) {
				if (lastWasFail) {
					clearSet.push(d);
					failSet.push(d);
				} else {
					clearSet.push(d);
					failSet.push({ x: d.x, y: null });
				}
			} else {
				if (!lastWasFail && !lastLastWasFail) {
					clearSet.push(d);
					failSet.push(d);
				} else {
					clearSet.push({ x: d.x, y: null });
					failSet.push(d);
				}
			}
			lastLastWasFail = lastWasFail;
			lastWasFail = ((d.y as number) ?? 0) < 80;
		}

		realData = [
			{ id: "fail", data: failSet },
			{ id: "clear", data: clearSet },
		];
	}

	const component = (
		<ResponsiveLine
			axisBottom={{
				format: usePercentXAxis
					? (x) => `${x / 100}%`
					: (x) => Math.floor(Number(x) / 4).toString(),
			}}
			axisLeft={{ tickValues: yAxes[type], format: (y) => `${y}%` }}
			// defs={[
			// 	{
			// 		id: "nc",
			// 		type: "linearGradient",
			// 		colors: [
			// 			{ offset: 0, color: colours[type][1] },
			// 			{ offset: 20, color: colours[type][1] },
			// 			{ offset: 20.01, color: colours[type][0] },
			// 			{ offset: 100, color: colours[type][0] },
			// 		],
			// 	},
			// ]}
			colors={colours[type]}
			crosshairType="x"
			curve="linear"
			data={realData}
			enableArea
			enableGridX={false}
			enablePoints={false}
			legends={[]}
			margin={{ top: 30, bottom: 50, left: 50, right: 50 }}
			motionConfig="stiff"
			// fill={[
			// 	{
			// 		match: { id: "clear" },
			// 		id: "nc",
			// 	},
			// ]}
			theme={TACHI_LINE_THEME}
			tooltip={(d) => (
				<ChartTooltip>
					Measure {Math.floor(Number(d.point.data.xFormatted) / 4).toString()}:{" "}
					{d.point.data.yFormatted}%
				</ChartTooltip>
			)}
			useMesh={true}
			xScale={{ type: "linear" }}
			yScale={{ type: "linear", min: 0, max: 100 }}
		/>
	);

	return (
		<>
			<div className="d-block d-md-none" style={{ height: mobileHeight, width: mobileWidth }}>
				{component}
			</div>
			<div className="d-none d-md-block" style={{ height, width }}>
				{component}
			</div>
		</>
	);
}
