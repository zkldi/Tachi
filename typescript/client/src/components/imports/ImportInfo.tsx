import MiniTable from "#components/tables/components/MiniTable";
import TachiTable from "#components/tables/components/TachiTable";
import ScoreTable from "#components/tables/scores/ScoreTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import { AllLUGPTStatsContext } from "#context/AllLUGPTStatsContext";
import { UserContext } from "#context/UserContext";
import { type ScoreDataset } from "#types/tables";
import { APIFetchV1 } from "#util/api";
import { CreateChartMap, CreateSongMap } from "#util/data";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Alert, ButtonGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type ChartDocument,
	type ImportDocument,
	type ScoreDocument,
	type SessionDocument,
	type SongDocument,
	type UserDocument,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

interface Data {
	import: ImportDocument;
	scores: ScoreDocument[];
	charts: ChartDocument[];
	songs: SongDocument[];
	sessions: SessionDocument[];
	user: UserDocument;
}

export default function ImportInfo({
	importID,
	noTopTable,
}: {
	importID: string;
	noTopTable?: boolean;
}) {
	const { data, error } = useApiQuery<Data>(`/imports/${importID}`);

	const { setUGS } = useContext(AllLUGPTStatsContext);
	const { user } = useContext(UserContext);
	const [hasUpdatedStats, setHasUpdatedStats] = useState(false);

	useEffect(() => {
		if (!data || hasUpdatedStats || !user) {
			return;
		}

		APIFetchV1<UserGameStats[]>(`/users/${user!.id}/game-profiles`).then((r) => {
			if (!r.success) {
				console.warn(`Can't update user stats post-import. ${r.description}`);
				return;
			}
			setUGS(r.body);
			setHasUpdatedStats(true);
		});
	}, [data]);

	const [tab, setTab] = useState<"errors" | "scores" | "sessions">("scores");

	if (error) {
		return (
			<>
				We've hit an error fetching info about this import. The import has still succeeded,
				though!
				<ApiError error={error} />
			</>
		);
	}

	if (!data) {
		return (
			<>
				<Loading />
				We're fetching stats about this import...
			</>
		);
	}

	const importDoc = data.import;

	const warningErrors = importDoc.errors.filter(
		(e) => e.type === "SongOrChartNotFound" || e.type === "OrphanExists"
	);
	const hardErrors = importDoc.errors.filter(
		(e) => e.type !== "SongOrChartNotFound" && e.type !== "OrphanExists"
	);

	return (
		<>
			{!noTopTable && (
				<>
					<div className="col-12">
						<MiniTable colSpan={2} headers={["Import Info"]}>
							<tr>
								<td>Imported Scores</td>
								<td>{importDoc.scoreIDs.length}</td>
							</tr>
							<tr>
								<td>Created Sessions</td>
								<td>{importDoc.createdSessions.length}</td>
							</tr>
							<tr>
								<td>Errors</td>
								<td>{importDoc.errors.length}</td>
							</tr>
						</MiniTable>
					</div>
					<div className="col-12">
						<Divider />
					</div>
				</>
			)}
			<div className="col-12 vstack gap-4">
				<ButtonGroup>
					<SelectButton id="scores" setValue={setTab} value={tab}>
						<Icon type="table" /> Scores
					</SelectButton>
					<SelectButton id="sessions" setValue={setTab} value={tab}>
						<Icon type="calendar-week" /> Sessions
					</SelectButton>
					<SelectButton id="errors" setValue={setTab} value={tab}>
						<Icon type="exclamation-triangle" /> Errors
					</SelectButton>
				</ButtonGroup>
				{tab === "errors" ? (
					<>
						{importDoc.errors.length === 0 && (
							<div className="text-center text-muted">No errors!</div>
						)}
						{warningErrors.length > 0 && (
							<>
								<h4>Warnings</h4>
								<Alert variant="warning">
									<strong>SongOrChartNotFound</strong> and{" "}
									<strong>OrphanExists</strong> scores are{" "}
									<strong>saved as orphans</strong> for nightly matching (around
									1 AM UTC) or manual reprocess — see{" "}
									{user ? (
										<Link to={`/u/${user.username}/orphans`}>
											Orphan scores
										</Link>
									) : (
										"Orphan scores"
									)}
									.
								</Alert>
								<TachiTable
									dataset={warningErrors}
									entryName="Warnings"
									headers={[
										["Warning Name", "Warning Name"],
										["Info", "Info"],
									]}
									rowFunction={(r) => (
										<tr>
											<td>{r.type}</td>
											<td>
												<div>{r.message}</div>
												{r.orphanID !== undefined && (
													<div className="mt-2 small text-muted">
														{user ? (
															<Link to={`/u/${user.username}/orphans`}>
																Open orphan queue
															</Link>
														) : (
															"Open orphan queue"
														)}
														{" "}
														(ID: <code>{r.orphanID}</code>)
													</div>
												)}
											</td>
										</tr>
									)}
								/>
							</>
						)}
						{hardErrors.length > 0 && (
							<>
								<h4>Errors</h4>
								<Alert variant="danger">
									Some of these errors might not be very useful. Depending on
									how scores are matched with data, all we have to display might
									be a hash.
								</Alert>
								<TachiTable
									dataset={hardErrors}
									entryName="Errors"
									headers={[
										["Error Name", "Error Name"],
										["Info", "Info"],
									]}
									rowFunction={(r) => (
										<tr>
											<td>{r.type}</td>
											<td>{r.message}</td>
										</tr>
									)}
								/>
							</>
						)}
					</>
				) : tab === "scores" ? (
					<ScoreTab data={data} />
				) : (
					<SessionTab data={data} />
				)}
			</div>
		</>
	);
}

function SessionTab({ data }: { data: Data }) {
	const importDoc = data.import;

	const dataset = [];

	const sessionMap: Map<string, SessionDocument> = new Map();

	for (const session of data.sessions) {
		sessionMap.set(session.sessionID, session);
	}

	for (const sesInfo of importDoc.createdSessions) {
		dataset.push({
			info: sesInfo,
			session: sessionMap.get(sesInfo.sessionID)!,
		});
	}

	return (
		<TachiTable
			dataset={dataset}
			entryName="Sessions"
			headers={[
				["Session Name", "Session Name"],
				["Change Info", "Change Info"],
				["Scores", "Scores"],
			]}
			rowFunction={(r) => (
				<tr>
					<td>
						<Link
							className="text-decoration-none"
							to={`/u/${r.session.userID}/games/${r.session.game}/sessions/${r.session.sessionID}`}
						>
							{r.session.name}
						</Link>
					</td>
					<td>{r.info.type}</td>
					<td>{r.session.scoreIDs.length}</td>
				</tr>
			)}
		/>
	);
}

function ScoreTab({ data }: { data: Data }) {
	const importDoc = data.import;

	if (importDoc.games.length === 0) {
		return (
			<div className="row mt-4">
				<span className="w-100 text-center">No scores...</span>
			</div>
		);
	} else if (importDoc.games.length > 1) {
		const datasets: { data: ScoreDataset; game: V3Game }[] = [];

		for (const game of importDoc.games) {
			const scoreDataset: ScoreDataset = [];

			const songMap = CreateSongMap(data.songs);
			const chartMap = CreateChartMap(data.charts);

			for (const [i, score] of data.scores.filter((e) => e.game === game).entries()) {
				scoreDataset.push({
					...score,
					__related: {
						song: songMap.get(score.songID)!,
						chart: chartMap.get(score.chartID)!,
						index: i,
						user: data.user,
					},
				});
			}

			datasets.push({ game, data: scoreDataset });
		}

		return <MultiPlaytypeScoreTable datasets={datasets} />;
	}

	const game = importDoc.games[0];

	const scoreDataset: ScoreDataset = [];

	const songMap = CreateSongMap(data.songs);
	const chartMap = CreateChartMap(data.charts);

	for (const [i, score] of data.scores.entries()) {
		scoreDataset.push({
			...score,
			__related: {
				song: songMap.get(score.songID)!,
				chart: chartMap.get(score.chartID)!,
				index: i,
				user: data.user,
			},
		});
	}

	return <ScoreTable dataset={scoreDataset} game={game} />;
}

function MultiPlaytypeScoreTable({
	datasets,
}: {
	datasets: { data: ScoreDataset; game: V3Game }[];
}) {
	const [selectedGame, setSelectedGame] = useState<V3Game>(datasets[0].game);

	const content = useMemo(() => datasets.find((e) => e.game === selectedGame)!, [selectedGame]);

	return (
		<div className="row">
			<div className="col-12">
				<div className="btn-group">
					{datasets.map((e) => (
						<SelectButton
							id={e.game}
							key={e.game}
							setValue={setSelectedGame}
							value={selectedGame}
						>
							{e.game}
						</SelectButton>
					))}
				</div>
			</div>

			<ScoreTable dataset={content.data} game={content.game} />
		</div>
	);
}
