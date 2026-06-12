import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { TACHI_LINE_THEME } from "#util/constants/chart-theme";
import { clamp } from "#util/misc";
import { getTheme } from "#util/themeUtils";
import {
	type Datum,
	type DatumValue,
	type LineSvgProps,
	type PointTooltipProps,
	ResponsiveLine,
	type Serie,
} from "@nivo/line";
import { COLOUR_SET, type Difficulties, type GameGroup } from "tachi-common";

import ChartTooltip from "./ChartTooltip";

const formatTime = (s: DatumValue) =>
	`${Math.floor(Number(s) / 60)
		.toString()
		.padStart(2, "0")}:${Math.floor(Number(s) % 60)
		.toString()
		.padStart(2, "0")}`;

const getScoreYAxisNotch = (game: GameGroup) => (s: number) => {
	if (game === "ongeki") {
		switch (s) {
			case 970_000:
				return "S";
			case 990_000:
				return "SS";
			case 1000_000:
				return "SSS";
			case 1007_500:
				return "SSS+";
		}
	}

	if (game === "chunithm") {
		switch (s) {
			case 990_000:
				return "S+";
			case 1000_000:
				return "SS";
			case 1005_000:
				return "SS+";
			case 1007_500:
				return "SSS";
			case 1009_000:
				return "SSS+";
		}
	}

	if (game === "maimaidx") {
		switch (s) {
			case 97:
				return "S";
			case 98:
				return "S+";
			case 99:
				return "SS";
			case 99.5:
				return "SS+";
			case 100:
				return "SSS";
			case 100.5:
				return "SSS+";
		}
	}

	return "";
};

const strokeColor = (
	type: "BELLS" | Difficulties["chunithm"] | Difficulties["maimaidx"] | Difficulties["ongeki"],
) => {
	const isLight = getTheme() === "light";

	if (type === "Basic" || type === "DX Basic" || type === "BASIC") {
		return `hsl(120, 60%, ${isLight ? 25 : 47}%)`;
	}

	if (type === "Advanced" || type === "DX Advanced" || type === "ADVANCED") {
		return `hsl(35, 60%, ${isLight ? 35 : 60}%)`;
	}

	if (type === "Expert" || type === "DX Expert" || type === "EXPERT") {
		return `hsl(330, 50%, ${isLight ? 35 : 67}%)`;
	}

	if (type === "Master" || type === "DX Master" || type === "MASTER") {
		return `hsl(280, 60%, ${isLight ? 35 : 67}%)`;
	}

	if (type === "ULTIMA") {
		return `hsl(360, 50%, ${isLight ? 35 : 67}%)`;
	}

	if (type === "BELLS") {
		return `hsl(55, 90%, ${isLight ? 35 : 42}%)`;
	}

	return `hsl(0, 0%, ${isLight ? 35 : 67}%)`;
};

const limitScoreGraph = (data: Serie[], minval: number) => {
	for (const val of data[0].data) {
		if (typeof val.y !== "number") {
			break;
		}
		if (val.y < minval) {
			// minval - 0.001 will be used to represent values below S
			// Without this, the line would cross the bottom axis
			// which looks very bad
			val.y = minval - 0.001;
		}
	}
	return data;
};

const scaleFloor = (data: Datum[], maximum: number | undefined) => {
	if (maximum === undefined) {
		return 0;
	}
	// Scale the chart so that it drops by 3/4, unless it's a flatline
	const lowestValue = Number(data.filter((v) => v.y !== null).pop()?.y ?? 0);
	return lowestValue === 0 ? -maximum : clamp(-maximum, Math.floor(lowestValue * 1.333), -1);
};

const platinumTooltip = (d: Datum, starValues: number[]) => {
	if (d.point.data.y < starValues[0]) {
		return (
			<>
				{"< 1★"} @ {formatTime(d.point.data.x)}
			</>
		);
	}
	for (let i = 1; i < 6; ++i) {
		if (d.point.data.y < starValues[i]) {
			return (
				<>
					MAX{d.point.data.y} ({i < 5 ? i + 1 : "虹"}
					{"★"}-{starValues[i] - d.point.data.y}) @ {formatTime(d.point.data.x)}
				</>
			);
		}
	}
	return (
		<>
			MAX{d.point.data.y === 0 ? "" : d.point.data.y} @ {formatTime(d.point.data.x)}
		</>
	);
};

export default function GekichumaiScoreChart({
	width = "100%",
	height = "100%",
	mobileHeight = "100%",
	mobileWidth = width,
	type,
	difficulty,
	maximumAbsoluteValue,
	data,
	game,
	duration,
}: {
	data: Serie[];
	difficulty: Difficulties["chunithm"] | Difficulties["maimaidx"] | Difficulties["ongeki"];
	duration: number;
	game: "chunithm" | "maimaidx" | "ongeki";
	height?: number | string;
	maximumAbsoluteValue?: number;
	mobileHeight?: number | string;
	mobileWidth?: number | string;
	type: "Bells" | "Life" | "Platinum" | "Score";
	width?: number | string;
} & ResponsiveLine["props"]) {
	let color = COLOUR_SET.gray;

	if (type === "Score") {
		if (game === "chunithm") {
			color =
				GAME_CLIENT_IMPLEMENTATIONS.chunithm.difficultyColours[
					difficulty as Difficulties["chunithm"]
				];
		} else if (game === "ongeki") {
			color =
				GAME_CLIENT_IMPLEMENTATIONS.ongeki.difficultyColours[
					difficulty as Difficulties["ongeki"]
				];
		} else if (game === "maimaidx") {
			color =
				GAME_CLIENT_IMPLEMENTATIONS.maimaidx.difficultyColours[
					difficulty as Difficulties["maimaidx"]
				];
		}
	} else if (type === "Bells") {
		color = COLOUR_SET.vibrantYellow;
	} else if (type === "Life") {
		color = COLOUR_SET.vibrantGreen;
	} else {
		color = COLOUR_SET.white;
	}

	const gradientId = type === "Score" ? difficulty : type;

	data[0].data.length = Math.min(data[0].data.length, Math.ceil(duration));

	const commonProps: Omit<LineSvgProps, "data"> = {
		margin: { top: 30, bottom: 50, left: 50, right: 50 },
		enableGridX: false,
		xScale: { type: "linear", min: 0, max: duration },
		axisBottom: { format: (d: number) => formatTime(d) },
		motionConfig: "stiff",
		crosshairType: "x",
		enablePoints: false,
		useMesh: true,
		theme: TACHI_LINE_THEME,
		curve: "linear",
		legends: [],
		lineWidth: 2,
		enableArea: true,
		areaOpacity: 0.25,
		defs: [
			{
				id: `gradient-${gradientId}`,
				type: "linearGradient",
				colors: [
					{ offset: 0, color: color },
					{ offset: 100, color: ChangeOpacity(color, 0.65) },
				],
			},
		],
		fill: [{ match: "*", id: `gradient-${gradientId}` }],
	};

	let component;

	if (type === "Score") {
		if (game === "ongeki") {
			component = (
				<ResponsiveLine
					{...commonProps}
					areaBaselineValue={970000}
					axisLeft={{
						tickValues: [970_000, 990_000, 1000_000, 1007_500, 1010_000],
						format: getScoreYAxisNotch(game),
					}}
					colors={strokeColor(difficulty)}
					data={limitScoreGraph(data, 970_000)}
					enableGridY={true}
					gridYValues={[970_000, 980_000, 990_000, 1000_000, 1007_500, 1010_000]}
					tooltip={(d: PointTooltipProps) => (
						<ChartTooltip>
							{typeof d.point.data.y === "number" && d.point.data.y < 970_000
								? "< 970,000"
								: d.point.data.yFormatted}{" "}
							@ {formatTime(d.point.data.x)}
						</ChartTooltip>
					)}
					yFormat={">-,.0f"}
					yScale={{ type: "linear", min: 970_000, max: 1010_000 }}
				/>
			);
		} else if (game === "chunithm") {
			component = (
				<ResponsiveLine
					{...commonProps}
					areaBaselineValue={990000}
					axisLeft={{
						tickValues: [990_000, 1000_000, 1005_000, 1007_500, 1009_000, 1010_000],
						format: getScoreYAxisNotch(game),
					}}
					colors={strokeColor(difficulty)}
					data={limitScoreGraph(data, 990_000)}
					enableGridY={true}
					gridYValues={[990_000, 1000_000, 1005_000, 1007_500, 1009_000, 1010_000]}
					tooltip={(d: PointTooltipProps) => (
						<ChartTooltip>
							{typeof d.point.data.y === "number" && d.point.data.y < 990_000
								? "< 990,000"
								: d.point.data.yFormatted}{" "}
							@ {formatTime(d.point.data.x)}
						</ChartTooltip>
					)}
					yFormat={">-,.0f"}
					yScale={{ type: "linear", min: 990_000, max: 1010_000 }}
				/>
			);
		} else if (game === "maimaidx") {
			component = (
				<ResponsiveLine
					{...commonProps}
					areaBaselineValue={97}
					axisLeft={{
						tickValues: [97, 98, 99, 99.5, 100, 100.5, 101],
						format: getScoreYAxisNotch(game),
					}}
					colors={strokeColor(difficulty)}
					data={limitScoreGraph(data, 97)}
					enableGridY={true}
					gridYValues={[97, 98, 99, 99.5, 100, 100.5, 101]}
					tooltip={(d: PointTooltipProps) => (
						<ChartTooltip>
							{typeof d.point.data.y === "number" && d.point.data.y < 97
								? "< 97% "
								: `${d.point.data.yFormatted}% `}
							@ {formatTime(d.point.data.x)}
						</ChartTooltip>
					)}
					yFormat={">-,.4f"}
					yScale={{ type: "linear", min: 97, max: 101 }}
				/>
			);
		}
	} else if (type === "Bells") {
		component = (
			<ResponsiveLine
				{...commonProps}
				areaBaselineValue={scaleFloor(data[0].data, maximumAbsoluteValue)}
				axisLeft={{ format: (e: number) => Math.floor(e) === e && e }}
				colors={strokeColor("BELLS")}
				data={data}
				enableGridY={false}
				tooltip={(d: PointTooltipProps) => (
					<ChartTooltip>
						MAX{d.point.data.y === 0 ? "" : d.point.data.y} @{" "}
						{formatTime(d.point.data.x)}
					</ChartTooltip>
				)}
				yScale={{
					type: "linear",
					min: scaleFloor(data[0].data, maximumAbsoluteValue),
					max: 0,
					stacked: false,
				}}
			/>
		);
	} else if (type === "Life") {
		const max = game === "ongeki" ? 100 : (data[0].data[0].y as number);
		const suffix = game === "ongeki" ? "%" : "";
		component = (
			<ResponsiveLine
				{...commonProps}
				areaBaselineValue={0}
				axisLeft={{ format: (d: number) => `${d}${suffix}` }}
				colors={strokeColor("BASIC")}
				data={data}
				enableGridY={false}
				tooltip={(d: PointTooltipProps) => (
					<ChartTooltip>
						{d.point.data.y}
						{suffix} @ {formatTime(d.point.data.x)}
					</ChartTooltip>
				)}
				yScale={{ type: "linear", min: 0, max }}
			/>
		);
	} else if (type === "Platinum") {
		const mav = maximumAbsoluteValue ?? 0; // shorthand
		const starValues = [
			Math.floor(mav * 0.94) - mav,
			Math.floor(mav * 0.95) - mav,
			Math.floor(mav * 0.96) - mav,
			Math.floor(mav * 0.97) - mav,
			Math.floor(mav * 0.98) - mav,
			Math.floor(mav * 0.99) - mav,
		];
		component = (
			<ResponsiveLine
				{...commonProps}
				areaBaselineValue={starValues[0]}
				axisLeft={{
					tickValues: starValues,
					format: (count: number) => {
						if (count === starValues[5]) {
							return "虹★";
						}
						for (let i = 0; i < 5; ++i) {
							if (count === starValues[i]) {
								return `${i + 1}★`;
							}
						}
						return "Error";
					},
				}}
				colors={strokeColor("LUNATIC")}
				data={limitScoreGraph(data, starValues[0])}
				enableGridY={true}
				gridYValues={starValues}
				tooltip={(d: PointTooltipProps) => (
					<ChartTooltip>{platinumTooltip(d, starValues)}</ChartTooltip>
				)}
				yFormat={">-,.0f"}
				yScale={{ type: "linear", min: starValues[0], max: 0 }}
			/>
		);
	}

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
