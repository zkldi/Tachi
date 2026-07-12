import { GetGradeDeltas, type GradeBoundary } from "tachi-common";

import { constrainedDeltaTdStyle } from "./delta-lamp-cell-layout";

const truncLine = "d-block text-truncate";

export default function DeltaCell({
	value,
	grade,
	gradeBoundaries,
	formatNumFn,
}: {
	formatNumFn?: (num: number) => string;
	grade: string;
	gradeBoundaries: Array<GradeBoundary<string>>;
	value: number;
}) {
	if (value === 0) {
		return (
			<td style={constrainedDeltaTdStyle} title="N/A">
				N/A
			</td>
		);
	}

	// eslint-disable-next-line prefer-const
	let { lower, upper, closer } = GetGradeDeltas(gradeBoundaries, grade, value, formatNumFn);

	// (max-)+20 is a stupid statistic. hard override it.
	if (lower.startsWith("(MAX-)+")) {
		closer = "upper";
	}

	if (closer === "upper") {
		const primary = upper;
		const secondary = lower;
		return (
			<td style={constrainedDeltaTdStyle} title={`${primary} — ${secondary}`}>
				<div className={truncLine} style={{ minWidth: 0 }}>
					<strong>{primary}</strong>
				</div>
				<small className={`${truncLine} text-body-secondary`} style={{ minWidth: 0 }}>
					{secondary}
				</small>
			</td>
		);
	} else {
		const primary = lower;
		const secondary = upper;
		return (
			<td style={constrainedDeltaTdStyle} title={`${primary} — ${secondary}`}>
				<div className={truncLine} style={{ minWidth: 0 }}>
					<strong>{primary}</strong>
				</div>
				<small className={`${truncLine} text-body-secondary`} style={{ minWidth: 0 }}>
					{secondary}
				</small>
			</td>
		);
	}
}
