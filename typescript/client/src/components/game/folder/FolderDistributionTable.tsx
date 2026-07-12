import { BarChartTooltip } from "#components/charts/ChartTooltip";
import MiniTable from "#components/tables/components/MiniTable";
import Muted from "#components/util/Muted";
import { ChangeOpacity } from "#util/color-opacity";
import { TACHI_BAR_THEME } from "#util/constants/chart-theme";
import { PercentFrom, StepFromToMax } from "#util/misc";
import { ResponsiveBar } from "@nivo/bar";
import { type integer } from "tachi-common";

export default function FolderDistributionTable<T extends string>({
	keys,
	values,
	colours,
	max,
}: {
	colours: Record<T, string>;
	keys: T[];
	max: integer;
	values: Record<T, integer>;
}) {
	const cumulativeValues: Record<T, integer> = {} as Record<T, integer>;

	let total = 0;
	for (const k of keys) {
		total += values[k] ?? 0;
		cumulativeValues[k] = total;
	}

	return (
		<MiniTable headers={["Value", "Count (Total)", "Thermometer"]}>
			{keys.map((k, i) => (
				<tr key={k}>
					<td style={{ backgroundColor: ChangeOpacity(colours[k], 0.15) }}>{k}</td>
					<td>
						{values[k] ?? 0} <Muted>({cumulativeValues[k]})</Muted>
					</td>
					{i === 0 && (
						<FolderThermometer
							colours={colours}
							keys={keys}
							max={max}
							values={values}
						/>
					)}
				</tr>
			))}
		</MiniTable>
	);
}

function FolderThermometer<T extends string>({
	keys,
	values,
	max,
	colours,
}: {
	colours: Record<T, string>;
	keys: T[];
	max: integer;
	values: Record<T, integer>;
}) {
	return (
		<td rowSpan={keys.length} style={{ width: 200, height: Math.max(160, 40 * keys.length) }}>
			<ResponsiveBar
				axisRight={{
					tickSize: 5,
					tickPadding: 5,
					tickValues: StepFromToMax(max),
				}}
				// @ts-expect-error Keys are appended with "." for some reason.
				borderColor={(k) => ChangeOpacity(colours[k.data.id], 0.4)}
				borderWidth={1}
				// @ts-expect-error temp
				colors={(k) => ChangeOpacity(colours[k.id], 0.5)}
				data={[Object.assign({ id: "" }, values)]}
				keys={keys}
				labelSkipHeight={12}
				margin={{ left: 10, right: 40, bottom: 10, top: 20 }}
				maxValue={max}
				motionConfig="stiff"
				padding={0.33}
				theme={Object.assign({}, TACHI_BAR_THEME)}
				tooltip={(d) => (
					<BarChartTooltip>
						<div>{d.label}</div>
						<div>
							{d.value} ({PercentFrom(d.value, max)})
						</div>
					</BarChartTooltip>
				)}
				valueScale={{ type: "linear" }}
			/>
		</td>
	);
}
