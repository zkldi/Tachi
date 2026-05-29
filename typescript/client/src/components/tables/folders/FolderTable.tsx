import Muted from "#components/util/Muted";
import usePreferredRanking from "#components/util/usePreferredRanking";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { WindowContext } from "#context/WindowContext";
import { type FolderDataset } from "#types/tables";
import { NumericSOV, StrSOV } from "#util/sorts";
import { CreateDefaultFolderSearchParams } from "#util/tables/create-search";
import React, { memo, useCallback, useContext, useMemo, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { type PBScoreDocument, type ScoreRatingAlgorithms, type V3Game } from "tachi-common";

import DifficultyCell from "../cells/DifficultyCell";
import IndicatorsCell from "../cells/IndicatorsCell";
import RankingCell, { type RankingViewMode } from "../cells/RankingCell";
import TimestampCell from "../cells/TimestampCell";
import TitleCell from "../cells/TitleCell";
import DropdownRow from "../components/DropdownRow";
import TachiTable, { type Header } from "../components/TachiTable";
import { usePBState } from "../components/UseScoreState";
import PBDropdown from "../dropdowns/PBDropdown";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import ChartHeader from "../headers/ChartHeader";
import { GetGPTCoreHeaders } from "../headers/GameHeaders";
import { EmptyHeader, FolderIndicatorHeader } from "../headers/IndicatorHeader";
import { CreateRankingHeader } from "../headers/RankingHeader";

export type FolderEnumBreakdownTablePreset = {
	metricKey: string;
	nonce: number;
	valueLabel: string;
};

/** Scroll target used when jumping from folder breakdown chips to this table (desktop-only flow). */
export const FOLDER_FOLDER_TABLE_SCROLL_INTO_VIEW_ID = "folder-folder-table-scroll-anchor";

function formatFolderEnumTableFilter(metricKey: string, valueLabel: string): string {
	const escaped = valueLabel.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
	return `${metricKey}=="${escaped}"`;
}

export default function FolderTable({
	dataset,
	game,
	folderBreakdownEnumTablePreset = null,
}: {
	dataset: FolderDataset;
	folderBreakdownEnumTablePreset?: FolderEnumBreakdownTablePreset | null;
	game: V3Game;
}) {
	const defaultRating = useScoreRatingAlg(game);

	const preferredRanking = usePreferredRanking();

	const [rating, setRating] = useState(defaultRating);
	const [rankingViewMode, setRankingViewMode] = useState<RankingViewMode>(
		preferredRanking ?? "global",
	);
	const [usePaginatedView, setUsePaginatedView] = useState(false);

	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);

	const folderSearchFunctions = useMemo(() => CreateDefaultFolderSearchParams(game), [game]);

	const externalPreset = useMemo(() => {
		if (!folderBreakdownEnumTablePreset || !isLg) {
			return null;
		}

		return {
			search: formatFolderEnumTableFilter(
				folderBreakdownEnumTablePreset.metricKey,
				folderBreakdownEnumTablePreset.valueLabel,
			),
			nonce: folderBreakdownEnumTablePreset.nonce,
		};
	}, [folderBreakdownEnumTablePreset, isLg]);

	const headers: Header<FolderDataset[0]>[] = [
		ChartHeader(game, (k) => k),
		FolderIndicatorHeader,
		["Song", "Song", StrSOV((x) => x.__related.song.title)],
		EmptyHeader,
		...GetGPTCoreHeaders<FolderDataset>(game, rating, setRating, (x) => x.__related.pb),
		CreateRankingHeader(
			rankingViewMode,
			setRankingViewMode,
			(k) => k.__related.pb?.rankingData,
		),
		["Last Raised", "Last Raised", NumericSOV((x) => x.__related.pb?.timeAchieved ?? 0)],
	];

	const rowFn = useCallback(
		(data: FolderDataset[0]) => (
			<Row data={data} game={game} rankingViewMode={rankingViewMode} rating={rating} />
		),
		[game, rankingViewMode, rating],
	);

	return (
		<div id={FOLDER_FOLDER_TABLE_SCROLL_INTO_VIEW_ID}>
			<Alert className="mb-4" variant="warning">
				<div className="d-flex flex-column flex-md-row align-items-md-center gap-3">
					<p className="flex-grow-1 mb-0">
						We're experimenting with a new view without pagination. If you're having
						performance issues, please report it.
					</p>
					<Button
						className="text-nowrap align-self-stretch align-self-md-auto fw-semibold"
						onClick={() => setUsePaginatedView((v) => !v)}
						variant="primary"
					>
						{usePaginatedView
							? "Switch to full list (experiment)"
							: "Switch back to paginated view"}
					</Button>
				</div>
			</Alert>
			<TachiTable
				dataset={dataset}
				entryName="Charts"
				externalSearchPreset={externalPreset}
				headers={headers}
				key={usePaginatedView ? "folder-paginated" : "folder-full"}
				pageLen={usePaginatedView ? 10 : 1000}
				pageLenOptions={[1000, 100, 50, 25, 10]}
				rowFunction={rowFn}
				rowKey={(d) => d.chartID}
				searchFunctions={folderSearchFunctions}
			/>
		</div>
	);
}

function Row({
	data,
	rating,
	game,
	rankingViewMode,
}: {
	data: FolderDataset[0];
	game: V3Game;
	rankingViewMode: RankingViewMode;
	rating: ScoreRatingAlgorithms[V3Game];
}) {
	const score = data.__related.pb;

	if (!score) {
		return (
			<tr>
				<DifficultyCell chart={data} game={game} />
				<IndicatorsCell highlight={false} />
				<TitleCell chart={data} game={game} song={data.__related.song} />
				<td colSpan={7}>
					<Muted>Not Played.</Muted>
				</td>
			</tr>
		);
	}

	return (
		<RowInner
			data={data}
			game={game}
			rankingViewMode={rankingViewMode}
			rating={rating}
			score={score}
		/>
	);
}

const RowInner = memo(
	({
		data,
		game,
		rating,
		rankingViewMode,
		score,
	}: {
		data: FolderDataset[0];
		game: V3Game;
		rankingViewMode: RankingViewMode;
		rating: ScoreRatingAlgorithms[V3Game];
		score: PBScoreDocument;
	}) => {
		// screw the rules of hooks
		const scoreState = usePBState(score);

		return (
			<DropdownRow
				dropdown={
					<PBDropdown
						chart={data}
						game={game}
						scoreState={scoreState}
						song={data.__related.song}
						userID={score.userID}
					/>
				}
			>
				<DifficultyCell chart={data} game={game} />
				<IndicatorsCell highlight={scoreState.highlight} />
				<TitleCell chart={data} game={game} song={data.__related.song} />
				<td>
					<Muted>PB</Muted>
				</td>
				<ScoreCoreCells chart={data} game={game} rating={rating} score={score} />
				<RankingCell
					rankingData={score.rankingData}
					rankingViewMode={rankingViewMode}
					userID={score.userID}
				/>
				<TimestampCell game={game} time={score.timeAchieved} />
			</DropdownRow>
		);
	},
	(prev, next) =>
		prev.data === next.data &&
		prev.score === next.score &&
		prev.game === next.game &&
		prev.rating === next.rating &&
		prev.rankingViewMode === next.rankingViewMode,
);
