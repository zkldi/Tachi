import useSetSubheader from "#components/layout/header/useSetSubheader";
import DifficultyCell from "#components/tables/cells/DifficultyCell";
import TitleCell from "#components/tables/cells/TitleCell";
import TachiTable from "#components/tables/components/TachiTable";
import { CascadingRatingValue } from "#components/tables/headers/ChartHeader";
import ApiError from "#components/util/ApiError";
import DebounceSearch from "#components/util/DebounceSearch";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { type GameProps } from "#types/react";
import { CreateSongMap } from "#util/data";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, { useState } from "react";
import { Col, Row } from "react-bootstrap";
import { type ChartDocument, FormatGame, type integer, type SongDocument } from "tachi-common";

export default function GameChartsPage({ game }: GameProps) {
	useSetSubheader(["Games", FormatGame(game), "Charts"], [game], `${FormatGame(game)} Songs`);

	const [search, setSearch] = useState("");

	return (
		<Row>
			<Col xs={12}>
				<DebounceSearch placeholder="Search songs and charts..." setSearch={setSearch} />
				<Divider />
			</Col>
			<Col xs={12}>
				<SearchSongsTable game={game} search={search} />
			</Col>
		</Row>
	);
}

function SearchSongsTable({ game, search }: { search: string } & GameProps) {
	const params = new URLSearchParams({ search });

	const { data, error } = useApiQuery<{
		charts: ({ __playcount: integer } & ChartDocument)[];
		songs: SongDocument[];
	}>(`/games/${game}/charts${search !== "" ? `?${params.toString()}` : ""}`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const songMap = CreateSongMap(data.songs);

	const dataset = [];

	for (const chart of data.charts) {
		dataset.push({
			...chart,
			__related: {
				song: songMap.get(chart.song.id)!,
			},
		});
	}

	return (
		<>
			{search === "" && (
				<div className="w-100 text-center">
					<h4>Displaying the most played charts for {FormatGame(game)}</h4>
					<Divider />
				</div>
			)}
			<TachiTable
				dataset={dataset}
				entryName="Charts"
				headers={[
					["Chart", "Chart", (a, b) => CascadingRatingValue(game, a, b)],
					["Song Title", "Song", StrSOV((x) => x.__related.song.title)],
					["Playcount", "Playcount", NumericSOV((x) => x.__playcount)],
				]}
				rowFunction={(d) => (
					<tr>
						<DifficultyCell chart={d} game={game} />
						<TitleCell chart={d} game={game} song={d.__related.song} />
						<td>{d.__playcount}</td>
					</tr>
				)}
				searchFunctions={{
					title: (x) => x.__related.song.title,
					artist: (x) => x.__related.song.artist,
					playcount: (x) => x.__playcount,
					difficulty: (x) => x.difficulty,
					level: (x) => x.levelNum,
				}}
			/>
		</>
	);
}
