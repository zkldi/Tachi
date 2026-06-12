import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import { ChangeOpacity } from "#util/color-opacity";
import { type ChartDocument, COLOUR_SET } from "tachi-common";

import MiniTable from "../components/MiniTable";
import { DIFFICULTY_CELL_WIDTH_PX } from "./difficulty-cell-layout";

const COLOUR_LOOKUP = {
	Beginner: COLOUR_SET.paleBlue,
	Easy: COLOUR_SET.green,
	Medium: COLOUR_SET.vibrantYellow,
	Hard: COLOUR_SET.red,
	Expert: COLOUR_SET.pink,
	Edit: COLOUR_SET.gray,
};

const truncLineCls = "d-block text-truncate";

export default function ITGDifficultyCell({ chart }: { chart: ChartDocument<"itg-stamina"> }) {
	let diff;

	if (chart.data.rankedLevel === null) {
		diff = `UNRANKED ${chart.data.difficultyTag} ${chart.data.chartLevel}`;
	} else {
		diff = `${chart.data.difficultyTag} ${chart.data.chartLevel}`;
	}

	let breakdown = "No Streams!";

	if (chart.data.breakdown) {
		if (chart.data.breakdown.detailed.length < 32) {
			breakdown = chart.data.breakdown.detailed;
		} else if (chart.data.breakdown.partiallySimplified.length < 32) {
			breakdown = chart.data.breakdown.partiallySimplified;
		} else if (chart.data.breakdown.simplified.length < 32) {
			breakdown = chart.data.breakdown.simplified;
		} else {
			breakdown = `${
				chart.data.breakdown.total
			} Total (${chart.data.breakdown.density.toFixed(0)}% Density)`;
		}
	}

	const minutes = Math.floor(chart.data.length / 60);
	let seconds: number | string = Math.floor(chart.data.length - minutes * 60);

	if (seconds < 10) {
		seconds = `0${seconds}`;
	}

	const lengthLabel = `(${minutes}:${seconds})`;

	const nativeTitleTooltip = [
		`${diff} [${chart.data.streamBPM?.toFixed() ?? "???"}]`,
		chart.data.charter,
		breakdown,
		lengthLabel,
	].join(" — ");

	return (
		<td
			style={{
				backgroundColor: ChangeOpacity(
					COLOUR_LOOKUP[chart.data.difficultyTag] ?? COLOUR_SET.gray,
					0.2,
				),
				boxSizing: "border-box",
				maxWidth: `${DIFFICULTY_CELL_WIDTH_PX}px`,
				minWidth: 0,
				overflow: "hidden",
				width: `${DIFFICULTY_CELL_WIDTH_PX}px`,
			}}
			title={nativeTitleTooltip}
		>
			<QuickTooltip
				tooltipContent={
					<>
						{chart.data.breakdown ? (
							<MiniTable colSpan={2} headers={["Breakdown"]}>
								<tr>
									<td>Total</td>
									<td>
										{chart.data.breakdown.total} Total (
										{chart.data.breakdown.density.toFixed(0)}% Density)
									</td>
								</tr>
								<tr>
									<td>Detailed</td>
									<td>{chart.data.breakdown.detailed}</td>
								</tr>
								<tr>
									<td>Simplified</td>
									<td>{chart.data.breakdown.simplified}</td>
								</tr>
								<tr>
									<td>Length</td>
									<td>
										{minutes}:{seconds}
									</td>
								</tr>
							</MiniTable>
						) : (
							<b>This chart has no streams.</b>
						)}
						{chart.data.rankedLevel === null && (
							<>
								<Divider />
								<b>
									This chart is not ranked. Take the level with a pinch of salt.
								</b>
							</>
						)}
						{chart.data.length > 60 * 16 && (
							<>
								<Divider />
								<b>This chart is a marathon!</b>
							</>
						)}
					</>
				}
				wide
			>
				<div style={{ maxWidth: "100%", minWidth: 0 }}>
					<span className={truncLineCls} style={{ minWidth: 0 }}>
						{diff} [{chart.data.streamBPM?.toFixed() ?? "???"}]
					</span>
					<Muted>
						<span className={truncLineCls} style={{ minWidth: 0 }}>
							{chart.data.charter}
						</span>
					</Muted>
					<span className={truncLineCls} style={{ minWidth: 0, fontSize: "0.9rem" }}>
						{breakdown}
					</span>
					<span className={truncLineCls} style={{ minWidth: 0 }}>
						{chart.data.length > 60 * 16 ? (
							<b>
								({minutes}:{seconds})
							</b>
						) : (
							`(${minutes}:${seconds})`
						)}
					</span>
				</div>
			</QuickTooltip>
		</td>
	);
}
