import Icon from "#components/util/Icon";
import { type SetState } from "#types/react";
import { UppercaseFirst } from "#util/misc";
import { type GameConfig, GetScoreMetrics } from "tachi-common";

import { type ZTableTHProps } from "./TachiTable";

export default function SelectableCompareType({
	metric,
	setMetric,
	changeSort,
	currentSortMode,
	reverseSort,
	gameConfig,
}: {
	gameConfig: GameConfig;
	metric: string;
	setMetric: SetState<string>;
} & ZTableTHProps) {
	return (
		<th className="gap-1 align-items-center justify-content-center">
			<select
				className="my-1 border-0 text-body fw-bolder bg-transparent rounded focus-ring focus-ring-light"
				onChange={(v) => setMetric(v.target.value)}
				value={metric}
			>
				{GetScoreMetrics(gameConfig, ["DECIMAL", "INTEGER", "ENUM"]).map((e) => (
					<option key={e} value={e}>
						Vs. ({UppercaseFirst(e)})
					</option>
				))}
			</select>
			<div onClick={() => changeSort("Vs.")}>
				<div className="d-flex justify-content-center text-nowrap gap-1">
					<Icon
						className={
							currentSortMode === "Vs." && reverseSort ? "opacity-100" : "opacity-25"
						}
						type="arrow-up"
					/>
					<Icon
						className={
							currentSortMode === "Vs." && !reverseSort ? "opacity-100" : "opacity-25"
						}
						type="arrow-down"
					/>
				</div>
			</div>
		</th>
	);
}
