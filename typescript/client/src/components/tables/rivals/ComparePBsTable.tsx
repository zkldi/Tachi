import Muted from "#components/util/Muted";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type ComparePBsDataset } from "#types/tables";
import { NumericSOV, StrSOV } from "#util/sorts";
import { CreatePBCompareSearchParams } from "#util/tables/create-search";
import React, { useEffect, useState } from "react";
import { GetGameConfig, GetScoreMetricConf, type V3Game } from "tachi-common";

import DifficultyCell from "../cells/DifficultyCell";
import PBCompareCell from "../cells/PBCompareCell";
import TitleCell from "../cells/TitleCell";
import SelectableCompareType from "../components/SelectableCompareType";
import TachiTable, { type Header, type ZTableTHProps } from "../components/TachiTable";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import ChartHeader from "../headers/ChartHeader";

export default function ComparePBsTable({
	dataset,
	game,
	baseUser,
	compareUser,
}: {
	baseUser: string;
	compareUser: string;
	dataset: ComparePBsDataset;
	game: V3Game;
}) {
	const gameConfig = GetGameConfig(game);
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	const [metric, setMetric] = useState<string>(gameConfig.defaultMetric);

	useEffect(() => {
		setMetric(gameConfig.defaultMetric);
	}, [gameConfig]);

	const headers: Header<ComparePBsDataset[0]>[] = [
		ChartHeader(game, (d) => d.chart),
		["Song", "Song", StrSOV((x) => x.song.title)],
		["", "", () => 1, () => <td colSpan={gptImpl.scoreHeaders.length}>{baseUser}</td>],
		[
			"Vs.",
			"Vs.",
			NumericSOV((x) => {
				if (!x.base) {
					return -Infinity;
				}

				if (!x.compare) {
					return Infinity;
				}

				const conf = GetScoreMetricConf(gameConfig, metric);

				if (!conf) {
					return 0; // wut
				}

				if (conf.type === "ENUM") {
					return (
						// @ts-expect-error this will work
						x.base.scoreData.enumIndexes[metric] -
						// @ts-expect-error this will work
						x.compare.scoreData.enumIndexes[metric]
					);
				}

				return (
					// @ts-expect-error this will work
					x.base.scoreData[metric] -
					// @ts-expect-error this will work
					x.compare.scoreData[metric]
				);
			}),
			(thProps: ZTableTHProps) => (
				<SelectableCompareType
					gameConfig={gameConfig}
					key={metric}
					metric={metric}
					setMetric={(e) => {
						setMetric(e);
						thProps.changeSort("Vs.");
					}}
					{...thProps}
				/>
			),
		],
		["", "", () => 1, () => <td colSpan={gptImpl.scoreHeaders.length}>{compareUser}</td>],
	];

	return (
		<TachiTable
			dataset={dataset}
			defaultReverseSort
			defaultSortMode="Vs."
			entryName="Charts"
			headers={headers}
			rowFunction={(data) => <Row data={data} game={game} metric={metric} />}
			searchFunctions={CreatePBCompareSearchParams(game)}
		/>
	);
}

function Row({ data, game, metric }: { data: ComparePBsDataset[0]; game: V3Game; metric: string }) {
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];
	const metricConf = GetScoreMetricConf(GetGameConfig(game), metric)!;

	return (
		<tr>
			<DifficultyCell alwaysShort chart={data.chart} game={game} />
			<TitleCell chart={data.chart} game={game} song={data.song} />
			{data.base ? (
				<ScoreCoreCells chart={data.chart} game={game} score={data.base} short />
			) : (
				<td colSpan={gptImpl.scoreHeaders.length}>
					<Muted>Not Played</Muted>
				</td>
			)}
			<PBCompareCell
				base={data.base}
				compare={data.compare}
				metric={metric}
				metricConf={metricConf}
			/>
			{data.compare ? (
				<ScoreCoreCells chart={data.chart} game={game} score={data.compare} short />
			) : (
				<td colSpan={gptImpl.scoreHeaders.length}>
					<Muted>Not Played</Muted>
				</td>
			)}
		</tr>
	);
}
