import { COLOUR_SET, type PBScoreDocument } from "tachi-common";
import { type ConfScoreMetric } from "tachi-common/types/metrics";

export default function PBCompareCell({
	base,
	compare,
	metricConf,
	metric,
}: {
	base: PBScoreDocument | null;
	compare: PBScoreDocument | null;
	metric: string;
	metricConf: ConfScoreMetric;
}) {
	let status: "draw" | "lose" | "win";

	let delta: number;

	const getMetricNum =
		metricConf.type === "ENUM"
			? // @ts-expect-error bad hacks
				(pb: PBScoreDocument) => pb.scoreData.enumIndexes[metric]
			: // @ts-expect-error bad hacks
				(pb: PBScoreDocument) => pb.scoreData[metric];

	// wut?
	if (!base && !compare) {
		status = "draw";
		delta = 0;
	} else if (!base) {
		status = "lose";
		delta = getMetricNum(compare!);
	} else if (!compare) {
		status = "win";
		delta = getMetricNum(base);
	} else {
		const b = getMetricNum(base);
		const c = getMetricNum(compare);

		status = cmp(b, c);
		delta = b - c;
	}

	return (
		<td
			style={{
				color:
					status === "win"
						? COLOUR_SET.green
						: status === "draw"
							? COLOUR_SET.gold
							: COLOUR_SET.red,
				borderLeft: "1px black double",
				borderRight: "1px black double",
			}}
		>
			{metricConf.type === "ENUM" ? (
				<>{(delta > 0 ? "+" : "") + delta}</>
			) : (
				(metricConf.type === "DECIMAL" || metricConf.type === "INTEGER") && (
					<strong>{(delta > 0 ? "+" : "") + metricConf.formatter(delta)}</strong>
				)
			)}
		</td>
	);
}

function cmp(a: number, b: number) {
	if (a === b) {
		return "draw";
	} else if (a > b) {
		return "win";
	}

	return "lose";
}
