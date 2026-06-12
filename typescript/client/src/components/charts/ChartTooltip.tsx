import { type JustChildren } from "#types/react";
import { type BarDatum, type BarTooltipProps } from "@nivo/bar";

/*function pointTooltipContent(point: PointTooltipProps["point"]) {
	return (
		<div>
			x:{point.data.xFormatted} y:{point.data.yFormatted}
		</div>
	);
}*/

export default function ChartTooltip({ children }: JustChildren) {
	return (
		<div className="tooltip bs-tooltip-top show rounded">
			<div className="tooltip-inner vstack gap-0.5 text-center">{children}</div>
		</div>
	);
}

const barTooltipContent = (data: BarTooltipProps<BarDatum>) => (
	<>
		<div>{data.label}</div>
		<div>{data.formattedValue}</div>
	</>
);

export function BarChartTooltip({
	barDatum,
	children,
}: {
	barDatum?: BarTooltipProps<BarDatum>;
	children?: React.ReactNode;
}) {
	return (
		<div className="tooltip bs-tooltip-top show rounded">
			<div className="tooltip-inner vstack gap-0.5 text-center">
				{barDatum && barTooltipContent(barDatum)}
				{children}
			</div>
		</div>
	);
}
