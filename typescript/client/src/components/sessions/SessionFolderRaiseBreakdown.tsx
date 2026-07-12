import Card from "#components/layout/page/Card";
import DropdownIndicatorCell from "#components/tables/cells/DropdownIndicatorCell";
import DropdownRow from "#components/tables/components/DropdownRow";
import MiniTable from "#components/tables/components/MiniTable";
import ApiError from "#components/util/ApiError";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import Select from "#components/util/Select";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type SessionFolderRaises, type SessionReturns } from "#types/api-returns";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartLink, CreateChartMap, CreateSongMap } from "#util/data";
import { JoinJSX } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import _ from "lodash";
import NaturalCompare from "natural-compare";
import { useEffect, useMemo, useState } from "react";
import { Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type ChartDocument,
	FormatChart,
	type GameConfig,
	GetGameConfig,
	GetScoreMetricConf,
	type SongDocument,
	type TableDocument,
	type V3Game,
} from "tachi-common";
import { type ConfEnumScoreMetric } from "tachi-common/types/metrics";

export default function SessionFolderRaiseBreakdown({
	sessionData,
}: {
	sessionData: SessionReturns;
}) {
	const reqUser = sessionData.user;
	const { settings } = useLoggedInUserGameSettings();

	const game = sessionData.session.game;
	const gameConfig = GetGameConfig(game);

	const [selectedTable, setSelectedTable] = useState<"LOADING" | TableDocument | null>("LOADING");

	const { data, error } = useApiQuery<Array<SessionFolderRaises>>(
		`/sessions/${sessionData.session.sessionID}/folder-raises`,
	);

	const { data: tableData, error: tableError } = useApiQuery<Array<TableDocument>>(
		`/games/${game}/tables`,
	);

	useEffect(() => {
		if (!tableData) {
			return;
		}

		let defaultTable;
		if (settings?.preferences.defaultTable) {
			defaultTable = tableData.find((e) => e.tableID === settings.preferences.defaultTable);
		} else {
			defaultTable = tableData.find((e) => e.default);
		}

		if (!defaultTable) {
			console.error(`Failed to find default table. Allowing all folders.`);
			setSelectedTable(null);
			return;
		}

		setSelectedTable(defaultTable);
	}, [tableData, settings]);

	const folders = useMemo(() => {
		if (!data) {
			return [];
		}

		// get all unique folders
		let folders = _.uniqBy(
			data.map((e) => e.folder),
			(x) => x.folderID,
		);

		// sort alphabetically
		folders.sort((a, b) => NaturalCompare(b.title, a.title));

		// hide certain folders
		if (selectedTable && selectedTable !== "LOADING") {
			folders = folders.filter((e) => selectedTable.folders.includes(e.slug));
		}

		return folders;
	}, [data, selectedTable]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (tableError) {
		return <ApiError error={tableError} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (!tableData) {
		return <Loading />;
	}

	const chartMap = CreateChartMap(sessionData.charts);
	const songMap = CreateSongMap(sessionData.songs);

	const preferredScoreBucket =
		settings?.preferences.preferredDefaultEnum ?? gameConfig.preferredDefaultEnum;

	if (selectedTable === "LOADING") {
		return <Loading />;
	}

	const allFolders = data.map((e) => e.folder);

	const filteredTables = tableData
		// disgusting filter: check if this table has any overlap with any
		// relevant folders. If not, don't show it.
		.filter((t) => allFolders.find((e) => t.folders.includes(e.slug)));

	if (filteredTables.length === 0) {
		return null;
	}

	return (
		<>
			<h1 className="w-100 text-center">Folder Raises</h1>

			{filteredTables.length > 1 && selectedTable !== null && (
				<div className="w-100">
					<Select
						name="Table"
						setValue={(t) => setSelectedTable(tableData.find((e) => e.tableID === t)!)}
						value={selectedTable.tableID}
					>
						{filteredTables.map((e) => (
							<option key={e.tableID} value={e.tableID}>
								{e.title}
							</option>
						))}
					</Select>
				</div>
			)}

			<Row>
				{folders.map((folder, i) => (
					<Col key={i} lg={6} xl={4} xs={12}>
						<Card
							className="my-4"
							header={
								<h3 className="text-center w-100">
									<Link
										className="text-decoration-none"
										to={`/u/${reqUser.username}/games/${game}/folders/${folder.slug}`}
									>
										{folder.title}
									</Link>
								</h3>
							}
						>
							<MiniTable colSpan={100} headers={["New Grades/Lamps (Cumulative)"]}>
								{data
									.filter((e) => e.folder.folderID === folder.folderID)
									.sort(SortRaisesNicely(gameConfig, preferredScoreBucket))
									.map((folderRaiseInfo, i) => (
										<FolderRaiseRender
											chartMap={chartMap}
											folderRaiseInfo={folderRaiseInfo}
											game={game}
											key={i}
											songMap={songMap}
										/>
									))}
							</MiniTable>
						</Card>
					</Col>
				))}
			</Row>
		</>
	);
}

const SortRaisesNicely = (gameConfig: GameConfig, preferredEnum: string) =>
	NumericSOV<SessionFolderRaises>((x) => {
		const conf = GetScoreMetricConf(gameConfig, x.type) as ConfEnumScoreMetric<string>;

		const baseValue = conf.values.indexOf(x.value);

		// if this is what the user prefers to see, push it to the top
		if (x.type === preferredEnum) {
			return baseValue + 1_000_000;
		}

		return baseValue;
	}, true);

function FolderRaiseRender({
	folderRaiseInfo,
	game,
	songMap,
	chartMap,
}: {
	chartMap: Map<string, ChartDocument>;
	folderRaiseInfo: SessionFolderRaises;
	game: V3Game;
	songMap: Map<string, SongDocument>;
}) {
	const colour =
		// @ts-expect-error lazy
		GAME_CLIENT_IMPLEMENTATIONS[game].enumColours[folderRaiseInfo.type][folderRaiseInfo.value];

	const newTotal = folderRaiseInfo.previousCount + folderRaiseInfo.raisedCharts.length;

	return (
		<DropdownRow
			dropdown={
				<div style={{ padding: "unset" }}>
					<ChartRaises
						chartMap={chartMap}
						game={game}
						raisedCharts={folderRaiseInfo.raisedCharts}
						songMap={songMap}
					/>
				</div>
			}
		>
			<td
				style={{
					backgroundColor: ChangeOpacity(colour, 0.2),
				}}
			>
				{folderRaiseInfo.value}
			</td>
			<td>
				<div>
					<Muted>{folderRaiseInfo.previousCount}</Muted>
					<span className="px-4">⟶</span>
					<strong style={{ fontSize: "1.25rem" }}>{newTotal}</strong>
					<Muted>/{folderRaiseInfo.totalCharts}</Muted>
				</div>
				{folderRaiseInfo.totalCharts - newTotal === 0 ? (
					<div className="w-100 mt-1 text-success">Folder Complete!</div>
				) : (
					folderRaiseInfo.totalCharts - newTotal < 10 && (
						<div className="w-100 mt-1 text-warning">
							{folderRaiseInfo.totalCharts - newTotal} to go!
						</div>
					)
				)}
			</td>
			<td>
				<span
					className="text-success"
					style={{
						fontSize: folderRaiseInfo.raisedCharts.length > 5 ? "1.25rem" : "1rem",
					}}
				>
					+{folderRaiseInfo.raisedCharts.length}
				</span>
			</td>
			<DropdownIndicatorCell />
		</DropdownRow>
	);
}

function ChartRaises({
	chartMap,
	songMap,
	game,
	raisedCharts,
}: {
	chartMap: Map<string, ChartDocument>;
	game: V3Game;
	raisedCharts: Array<string>;
	songMap: Map<string, SongDocument>;
}) {
	const els = [];

	for (const chartID of raisedCharts) {
		const chart = chartMap.get(chartID);

		if (!chart) {
			console.warn(`No chart '${chartID}' exists? continuing.`);
			continue;
		}
		const song = songMap.get(chart.song.id);

		if (!song) {
			console.warn(`No song '${chart.song.id}' exists, but the chart does?`);
			continue;
		}

		els.push(
			<span>
				<Link className="text-success" to={CreateChartLink(chart)}>
					+ {FormatChart(chart)}
				</Link>
			</span>,
		);
	}

	return (
		<div className="my-2" style={{ textAlign: "left", paddingLeft: "1rem" }}>
			{JoinJSX(els, <br />)}
		</div>
	);
}
