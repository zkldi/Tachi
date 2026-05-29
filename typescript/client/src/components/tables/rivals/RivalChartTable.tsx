import Muted from "#components/util/Muted";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { type RivalChartDataset } from "#types/tables";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, { useState } from "react";
import { type AnyScoreRatingAlg, type ChartDocument, type V3Game } from "tachi-common";

import IndexCell from "../cells/IndexCell";
import RankingCell, { type RankingViewMode } from "../cells/RankingCell";
import TimestampCell from "../cells/TimestampCell";
import UserCell from "../cells/UserCell";
import DropdownRow from "../components/DropdownRow";
import TachiTable, { type Header } from "../components/TachiTable";
import { GraphAndJudgementDataComponent } from "../dropdowns/components/DocumentComponent";
import { GPTDropdownSettings } from "../dropdowns/GPTDropdownSettings";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import { GetGPTCoreHeaders } from "../headers/GameHeaders";
import { CreateRankingHeader } from "../headers/RankingHeader";

export default function RivalChartTable({
	dataset,
	game,
	chart,
}: {
	chart: ChartDocument;
	dataset: RivalChartDataset;
	game: V3Game;
}) {
	const defaultRating = useScoreRatingAlg(game);

	const [rating, setRating] = useState(defaultRating);
	const [rankingViewMode, setRankingViewMode] = useState<RankingViewMode>("global");

	const headers: Header<RivalChartDataset[0]>[] = [
		["#", "#", NumericSOV((x) => x.__related.index)],
		["User", "User", StrSOV((x) => x.username)],
		...GetGPTCoreHeaders<RivalChartDataset>(game, rating, setRating, (x) => x.__related.pb),
		CreateRankingHeader(
			rankingViewMode,
			setRankingViewMode,
			(k) => k.__related.pb?.rankingData,
		),
		["Last Raised", "Last Raised", NumericSOV((x) => x.__related.pb?.timeAchieved ?? 0)],
	];

	return (
		<TachiTable
			dataset={dataset}
			defaultSortMode="#"
			entryName="Rivals"
			headers={headers}
			noTopDisplayStr
			rowFunction={(data) => (
				<Row
					chart={chart}
					data={data}
					game={game}
					key={data.id}
					rankingViewMode={rankingViewMode}
					rating={rating}
				/>
			)}
		/>
	);
}

function Row({
	data,
	rating,
	game,
	chart,
	rankingViewMode,
}: {
	chart: ChartDocument;
	data: RivalChartDataset[0];
	game: V3Game;
	rankingViewMode: RankingViewMode;
	rating: AnyScoreRatingAlg;
}) {
	const pb = data.__related.pb;

	if (!pb) {
		return (
			<tr>
				<td>N/A</td>
				<UserCell game={game} user={data} />
				<td colSpan={7}>
					<Muted>Not Played.</Muted>
				</td>
			</tr>
		);
	}

	return (
		<DropdownRow
			dropdown={
				<GraphAndJudgementDataComponent
					chart={chart}
					score={data.__related.pb}
					{...{ ...GPTDropdownSettings(game) }}
				/>
			}
			nested
		>
			<IndexCell index={data.__related.index} />
			<UserCell game={game} user={data} />
			<ScoreCoreCells chart={chart} game={game} rating={rating} score={pb} />
			<RankingCell
				rankingData={pb.rankingData}
				rankingViewMode={rankingViewMode}
				userID={pb.userID}
			/>
			<TimestampCell game={game} time={pb.timeAchieved} />
		</DropdownRow>
	);
}
