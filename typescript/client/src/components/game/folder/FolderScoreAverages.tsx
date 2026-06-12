import DifficultyCell from "#components/tables/cells/DifficultyCell";
import TitleCell from "#components/tables/cells/TitleCell";
import MiniTable from "#components/tables/components/MiniTable";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import Muted from "#components/util/Muted";
import { type GameProfileProps } from "#types/react";
import { type FolderDataset } from "#types/tables";
import { ToFixedFloor, UppercaseFirst } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import React, { useMemo } from "react";
import { GetGameConfig } from "tachi-common";
import {
	type ConfDecimalScoreMetric,
	type ConfIntegerScoreMetric,
} from "tachi-common/types/metrics";

export default function FolderScoreAverages({
	folderDataset,
	game,
}: { folderDataset: FolderDataset } & GameProfileProps) {
	const gameConfig = GetGameConfig(game);

	const metrics = {
		...gameConfig.providedMetrics,
		...gameConfig.derivedMetrics,
	};

	const entries = Object.entries(metrics);

	const relevantScoreMetrics = entries
		.filter(([k, v]) => {
			if (v.type !== "DECIMAL" && v.type !== "INTEGER") {
				return false;
			}

			const v2 = v as ConfDecimalScoreMetric | ConfIntegerScoreMetric;

			if (v2.chartDependentMax) {
				return false;
			}

			return true;
		})
		.map((e) => e[0]);

	const { unplayed, played, data } = useMemo(() => {
		const data: Record<string, any> = {};

		const played = folderDataset.filter((e) => e.__related.pb);

		const unplayed = folderDataset.length - played.length;

		for (const metric of relevantScoreMetrics) {
			const total = played.reduce(
				// @ts-expect-error accessing property unchecked oh nooo
				// eslint-disable-next-line no-constant-binary-expression
				(acc, e) => acc + e.__related.pb?.scoreData[metric] ?? 0,
				0,
			);

			const sorted = played.sort(
				// @ts-expect-error accessing property unchecked oh nooo
				NumericSOV((k) => k.__related.pb?.scoreData[metric] ?? -Infinity),
			);

			const worst = sorted[0];
			const best = sorted[sorted.length - 1];

			let avgAll = total / folderDataset.length;
			let avgPlayed = total / played.length;

			if (metrics[metric].type === "INTEGER") {
				avgAll = Math.floor(avgAll);
				avgPlayed = Math.floor(avgPlayed);
			}

			data[metric] = {
				avgAll,
				avgPlayed,
				worst,
				best,
			};
		}

		return {
			played,
			unplayed,
			data,
		};
	}, [folderDataset, relevantScoreMetrics]);

	if (relevantScoreMetrics.length === 0) {
		return <div>This game has nothing to show you!</div>;
	}

	if (played.length === 0) {
		return <div>You haven't played anything in this folder!</div>;
	}

	const playRate = (100 * played.length) / folderDataset.length;

	return (
		<div className="overflow-auto">
			<MiniTable colSpan={100} headers={["Score Stats"]}>
				<tr>
					<td>Played</td>
					<td
						className={`text-${
							playRate === 100 ? "success" : playRate > 50 ? "warning" : "danger"
						}`}
						colSpan={6}
					>
						{ToFixedFloor(playRate, 2)}%
						{unplayed > 0 && (
							<>
								<br />
								<Muted>
									({played.length} played, {unplayed} unplayed)
								</Muted>
							</>
						)}
					</td>
				</tr>
				{Object.entries(data).map(([k, v]) => (
					<React.Fragment key={k}>
						<tr>
							<td>{UppercaseFirst(k)} Average (Played Charts)</td>
							{/* @ts-expect-error this won't fail */}
							<td colSpan={6}>{metrics[k].formatter(v.avgPlayed)}</td>
						</tr>
						<tr>
							<td>{UppercaseFirst(k)} Average (All Charts)</td>
							{/* @ts-expect-error this won't fail */}
							<td colSpan={6}>{metrics[k].formatter(v.avgAll)}</td>
						</tr>
						<tr>
							<td>Best {UppercaseFirst(k)}</td>
							<DifficultyCell alwaysShort chart={v.best} game={game} />
							<TitleCell
								chart={v.best}
								comment={v.best.__related.pb.comment}
								game={game}
								song={v.best.__related.song}
							/>
							<ScoreCoreCells
								chart={v.best}
								game={game}
								score={v.best.__related.pb}
								short
							/>
						</tr>
						<tr>
							<td>Worst {UppercaseFirst(k)}</td>
							<DifficultyCell alwaysShort chart={v.worst} game={game} />
							<TitleCell
								chart={v.worst}
								comment={v.worst.__related.pb.comment}
								game={game}
								song={v.worst.__related.song}
							/>
							<ScoreCoreCells
								chart={v.worst}
								game={game}
								score={v.worst.__related.pb}
								short
							/>
						</tr>
					</React.Fragment>
				))}
			</MiniTable>
		</div>
	);
}
