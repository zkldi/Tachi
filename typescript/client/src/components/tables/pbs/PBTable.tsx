import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { type PBDataset } from "#types/tables";
import { NumericSOV } from "#util/sorts";
import { CreateDefaultPBSearchParams } from "#util/tables/create-search";
import { GetPBLeadingHeaders } from "#util/tables/get-pb-leaders";
import React, { useEffect, useState } from "react";
import { type AnyScoreRatingAlg, type V3Game } from "tachi-common";

import DropdownIndicatorCell from "../cells/DropdownIndicatorCell";
import IndexCell from "../cells/IndexCell";
import RankingCell, { type RankingViewMode } from "../cells/RankingCell";
import TimestampCell from "../cells/TimestampCell";
import DropdownRow from "../components/DropdownRow";
import TachiTable, { type Header } from "../components/TachiTable";
import { usePBState } from "../components/UseScoreState";
import PBDropdown from "../dropdowns/PBDropdown";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import ChartHeader from "../headers/ChartHeader";
import { GetGPTCoreHeaders } from "../headers/GameHeaders";
import { EmptyHeader } from "../headers/IndicatorHeader";
import { CreateRankingHeader } from "../headers/RankingHeader";
import PBLeadingRows from "./PBLeadingRows";

export default function PBTable({
	dataset,
	game,
	indexCol = true,
	showPlaycount = false,
	showChart = true,
	alg,
	defaultRankingViewMode,
	showUser,
}: {
	alg?: AnyScoreRatingAlg;
	dataset: PBDataset;
	defaultRankingViewMode?: RankingViewMode | null;
	game: V3Game;
	indexCol?: boolean;
	showChart?: boolean;
	showPlaycount?: boolean;
	showUser?: boolean;
}) {
	const defaultRating = useScoreRatingAlg(game);
	const [rating, setRating] = useState(alg ?? defaultRating);

	useEffect(() => {
		setRating(alg ?? defaultRating);
	}, [alg, defaultRating]);
	const [rankingViewMode, setRankingViewMode] = useState<RankingViewMode>(
		defaultRankingViewMode ?? "global",
	);

	const headers: Header<PBDataset[0]>[] = [
		...GetPBLeadingHeaders(
			showUser ?? false,
			showChart,
			ChartHeader(game, (k) => k.__related.chart),
		),
		EmptyHeader,
		...GetGPTCoreHeaders<PBDataset>(game, rating, setRating, (x) => x),
		CreateRankingHeader(rankingViewMode, setRankingViewMode, (k) => k.rankingData),
		["Last Raised", "Last Raised", NumericSOV((x) => x.timeAchieved ?? 0)],
		EmptyHeader,
	];

	if (showPlaycount) {
		headers.pop();

		headers.push(["Playcount", "Plays", NumericSOV((x) => x.__playcount ?? 0)]);
		headers.push(EmptyHeader);
	}

	if (indexCol) {
		headers.unshift(["#", "#", NumericSOV((x) => x.__related.index)]);
	}

	return (
		<TachiTable
			dataset={dataset}
			defaultSortMode={indexCol ? "#" : undefined}
			entryName="PBs"
			headers={headers}
			rowFunction={(pb) => (
				<Row
					game={game}
					indexCol={indexCol}
					key={`${pb.chartID}:${pb.userID}`}
					pb={pb}
					rankingViewMode={rankingViewMode}
					rating={rating}
					showChart={showChart}
					showPlaycount={showPlaycount}
					showUser={showUser ?? false}
				/>
			)}
			searchFunctions={CreateDefaultPBSearchParams(game)}
		/>
	);
}

function Row({
	pb,
	indexCol,
	showPlaycount,
	showChart,
	showUser,
	game,
	rating,
	rankingViewMode,
}: {
	game: V3Game;
	indexCol: boolean;
	pb: PBDataset[0];
	rankingViewMode: RankingViewMode;
	// ts bug?
	rating: any; // ScoreRatingAlgorithms[I];
	showChart: boolean;
	showPlaycount: boolean;
	showUser: boolean;
}) {
	const scoreState = usePBState(pb);

	return (
		<DropdownRow
			dropdown={
				<PBDropdown
					chart={pb.__related.chart}
					game={game}
					scoreState={scoreState}
					song={pb.__related.song}
					userID={pb.userID}
				/>
			}
		>
			{indexCol && <IndexCell index={pb.__related.index} />}
			<PBLeadingRows {...{ showUser, showChart, pb, scoreState }} />
			<ScoreCoreCells chart={pb.__related.chart} game={game} rating={rating} score={pb} />
			<RankingCell
				rankingData={pb.rankingData}
				rankingViewMode={rankingViewMode}
				userID={pb.userID}
			/>
			<TimestampCell game={game} time={pb.timeAchieved} />
			{showPlaycount && <td>{pb.__playcount ?? 0}</td>}
			<DropdownIndicatorCell />
		</DropdownRow>
	);
}
