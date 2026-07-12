import BMSOrPMSDifficultyCell from "#components/tables/cells/BMSOrPMSDifficultyCell";
import TitleCell from "#components/tables/cells/TitleCell";
import TachiTable from "#components/tables/components/TachiTable";
import ChartHeader from "#components/tables/headers/ChartHeader";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TachiConfig } from "#lib/config";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { CreateSongMap } from "#util/data";
import { NumericSOV, StrSOV } from "#util/sorts";
import { Col, Row } from "react-bootstrap";
import { BMS_TABLES, type ChartDocument, type SongDocument } from "tachi-common";
import { FormatSieglindeBMS } from "tachi-common/config/game-support/bms";

type BMSGames = "bms-7k" | "bms-14k";

type DatasetElement = { __related: { song: SongDocument } } & ChartDocument<BMSGames>;

function Component({ game }: GameProfileProps) {
	const { data, error } = useApiQuery<{
		charts: Array<ChartDocument<BMSGames>>;
		songs: Array<SongDocument<"bms">>;
	}>(`/games/${game}/sieglinde-charts`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const dataset: Array<DatasetElement> = [];

	const songMap = CreateSongMap(data.songs);

	for (const chart of data.charts) {
		const song = songMap.get(chart.song.id);

		if (!song) {
			console.warn(`Couldn't find a parent song for ${chart.song.id}? Skipping.`);
			continue;
		}

		dataset.push({
			...chart,
			__related: {
				song,
			},
		});
	}

	const bmsGame = (game === "bms-7k" || game === "bms-14k" ? game : "bms-7k") as BMSGames;

	return (
		<Row>
			<Col xs={12}>
				<span style={{ fontSize: "1.5rem" }}>
					Sieglinde is a rating algorithm based on LR2IR clear rates. It exists to provide
					unified EASY CLEAR and HARD CLEAR ratings for commonly played tables. <br />
					It's not perfect, and you might disagree with some (or a lot) of the ratings. By
					doing so, you're disagreeing with LR2IR clear rates, so make of that what you
					will.
					<br />
					<br />
					Use filters like <code>insane:yes</code> to limit results to only the insane
					table.
				</span>
				<Divider />
				<TachiTable
					dataset={dataset}
					defaultReverseSort
					defaultSortMode="EASY CLEAR Sieglinde"
					entryName="Charts"
					headers={[
						ChartHeader(bmsGame, (k) => k as ChartDocument),
						["Song", "Song", StrSOV((x) => x.__related.song.title)],
						[
							"EASY CLEAR Sieglinde",
							"EC sgl.",
							NumericSOV(
								(x) => (x as ChartDocument<"bms-7k">).data.sglEC ?? -Infinity,
							),
						],
						[
							"HARD CLEAR Sieglinde",
							"EC sgl.",
							NumericSOV(
								(x) => (x as ChartDocument<"bms-7k">).data.sglHC ?? -Infinity,
							),
						],
					]}
					rowFunction={(d) => (
						<tr>
							<BMSOrPMSDifficultyCell
								chart={d as ChartDocument<BMSGames>}
								game={bmsGame}
							/>
							<TitleCell chart={d} game={bmsGame} song={d.__related.song} />
							<td>
								{FormatSieglindeBMS((d as ChartDocument<"bms-7k">).data.sglEC ?? 0)}
							</td>
							<td>
								{FormatSieglindeBMS((d as ChartDocument<"bms-7k">).data.sglHC ?? 0)}
							</td>
						</tr>
					)}
					searchFunctions={Object.fromEntries(
						BMS_TABLES.map((e) => [
							e.asciiPrefix,
							(d: DatasetElement) =>
								!!Object.keys(
									(d as ChartDocument<"bms-7k">).data.tableFolders,
								).find((k) => k === e.prefix),
						]),
					)}
				/>
			</Col>
		</Row>
	);
}

export const BMSSieglindeInfoTool: GameUtility = {
	name: `${TachiConfig.NAME} Sieglinde Info`,
	urlPath: "sieglinde",
	description: `View the current state of the sieglinde rating algorithm.`,
	component: Component,
	personalUseOnly: true,
};
