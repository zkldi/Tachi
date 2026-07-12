import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { type ScoreDataset } from "#types/tables";
import { NumericSOV } from "#util/sorts";
import { useState } from "react";
import {
	type ChartDocument,
	type integer,
	type ScoreDocument,
	type ScoreRatingAlgorithms,
	type V3Game,
} from "tachi-common";

import DropdownIndicatorCell from "../cells/DropdownIndicatorCell";
import TimestampCell from "../cells/TimestampCell";
import DropdownRow from "../components/DropdownRow";
import TachiTable from "../components/TachiTable";
import { GraphAndJudgementDataComponent } from "../dropdowns/components/DocumentComponent";
import { GameDropdownSettings } from "../dropdowns/GameDropdownSettings";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import { GetGameCoreHeaders } from "../headers/GameHeaders";
import { EmptyHeader } from "../headers/IndicatorHeader";

export default function HistoryScoreTable({
	dataset,
	pageLen = 10,
	game,
	chart,
}: {
	chart: ChartDocument;
	dataset: ScoreDocument[];
	game: V3Game;
	pageLen?: integer;
}) {
	const defaultRating = useScoreRatingAlg(game);

	const [rating, setRating] = useState(defaultRating);

	const headers = GetGameCoreHeaders<ScoreDataset>(game, rating, setRating, (k) => k);

	return (
		<TachiTable
			dataset={dataset as ScoreDataset}
			defaultReverseSort
			defaultSortMode="Timestamp"
			entryName="Scores"
			headers={[
				...headers,
				["Timestamp", "Timestamp", NumericSOV((x) => x.timeAchieved ?? 0)],
				EmptyHeader,
			]}
			noTopDisplayStr
			pageLen={pageLen}
			rowFunction={(sc) => (
				<Row chart={chart} game={game} key={sc.scoreID} rating={rating} sc={sc} />
			)}
		/>
	);
}

function Row({
	sc,
	chart,
	rating,
	game,
}: {
	chart: ChartDocument;
	game: V3Game;
	rating: ScoreRatingAlgorithms[V3Game];
	sc: ScoreDocument;
}) {
	return (
		<DropdownRow
			dropdown={
				<GraphAndJudgementDataComponent
					chart={chart}
					score={sc}
					{...{ ...GameDropdownSettings(game) }}
				/>
			}
			nested
		>
			<ScoreCoreCells chart={chart} game={game} rating={rating as any} score={sc} />
			<TimestampCell game={game} service={sc.service} time={sc.timeAchieved} />
			<DropdownIndicatorCell />
		</DropdownRow>
	);
}
