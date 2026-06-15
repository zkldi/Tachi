import Card from "#components/layout/page/Card";
import CardHeader from "#components/layout/page/CardHeader";
import CardNavButton from "#components/layout/page/CardNavButton";
import MiniTable from "#components/tables/components/MiniTable";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import AsyncLoader from "#components/util/AsyncLoader";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import ReferToUser from "#components/util/ReferToUser";
import { AllLUGPTStatsContext } from "#context/AllLUGPTStatsContext";
import { UserContext } from "#context/UserContext";
import {
	type UGPTPreferenceChartStatsReturn,
	type UGPTPreferenceFolderStatsReturn,
	type UGPTPreferenceStatsReturn,
} from "#types/api-returns";
import { type GamePT, type UGPT } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { CreateChartLink } from "#util/data";
import { ToPercent, UppercaseFirst } from "#util/misc";
import { nanoid } from "nanoid";
import React, { useContext, useState } from "react";
import { Alert, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	type ChartDocument,
	type FolderDocument,
	FormatChart,
	GetGameConfig,
	GetScoreMetricConf,
	type ShowcaseStatDetails,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import UGPTStatContainer from "./UGPTStatContainer";
import UGPTStatCreator from "./UGPTStatCreator";

export default function UGPTStatShowcase({ reqUser, game }: UGPT) {
	const { ugs } = useContext(AllLUGPTStatsContext);
	const { user } = useContext(UserContext);

	const [projectingStats, setProjectingStats] = useState(false);

	const hasUserPlayedGame = ugs && !!ugs.filter((e) => e.game === game).length;

	const userIsReqUser = user && user.id === reqUser.id;

	const shouldFetchThisUserData = hasUserPlayedGame && !userIsReqUser;

	const [customShow, setCustomShow] = useState(false);
	const [customStat, setCustomStat] = useState<ShowcaseStatDetails | null>(null);

	return (
		<>
			<Card
				cardBodyClassName="py-4 px-3 px-md-4"
				className="bg-body-secondary bg-opacity-50 showcase-main-card"
				footer={
					<div className="d-flex flex-wrap justify-content-center gap-2 py-3 px-2">
						{hasUserPlayedGame &&
							!userIsReqUser &&
							(projectingStats ? (
								<OverlayTrigger
									overlay={
										<Tooltip id="quick-panel-tooltip">
											Return to {reqUser.username}'s selected stats.
										</Tooltip>
									}
									placement="top"
								>
									<button
										className="btn btn-success btn-sm"
										onClick={() => setProjectingStats(false)}
										type="button"
									>
										<i className="fas fa-sync me-1" />
										Their stats
									</button>
								</OverlayTrigger>
							) : (
								<OverlayTrigger
									overlay={
										<Tooltip id={nanoid()}>
											Change the displayed stats to the same ones you use!
										</Tooltip>
									}
									placement="top"
								>
									<button
										className="btn btn-outline-secondary btn-sm text-body"
										onClick={() => setProjectingStats(true)}
										type="button"
									>
										<i className="fas fa-sync me-1" />
										Use my picks
									</button>
								</OverlayTrigger>
							))}
						<OverlayTrigger
							overlay={
								<Tooltip id="quick-panel-tooltip">Evaluate a one-off stat.</Tooltip>
							}
							placement="top"
						>
							<button
								className="btn btn-outline-secondary btn-sm text-body"
								onClick={() => setCustomShow(true)}
								type="button"
							>
								<i className="fas fa-file-signature me-1" />
								One-off stat
							</button>
						</OverlayTrigger>
					</div>
				}
				header={
					<CardHeader
						rightContent={
							userIsReqUser ? (
								<CardNavButton
									hoverText="Modify your statistics showcase."
									to={`/u/${user!.username}/games/${game}/settings?showcase=yea`}
									type="edit"
								/>
							) : null
						}
					>
						<h3 className="fs-4 mb-0 pe-5 px-2">
							{projectingStats
								? `${user!.username}'s Stat Showcase (Projected onto ${
										reqUser.username
									})`
								: `${reqUser.username}'s Stat Showcase`}
						</h3>
					</CardHeader>
				}
			>
				<AsyncLoader
					promiseFn={async () => {
						const res = await APIFetchV1<UGPTPreferenceStatsReturn[]>(
							`/users/${reqUser.id}/games/${game}/showcase${
								projectingStats ? `?projectUser=${user!.id}` : ""
							}`,
						);

						if (!res.success) {
							throw new Error(res.description);
						}

						if (shouldFetchThisUserData) {
							const res2 = await APIFetchV1<UGPTPreferenceStatsReturn[]>(
								`/users/${user!.id}/games/${game}/showcase${
									!projectingStats ? `?projectUser=${reqUser.id}` : ""
								}`,
							);

							if (!res2.success) {
								throw new Error(res2.description);
							}

							return { reqUserData: res.body, thisUserData: res2.body };
						}

						return { reqUserData: res.body };
					}}
				>
					{(data) => (
						<div className="container-fluid px-0">
							{customStat ? (
								<div className="row justify-content-center g-3 mb-4">
									<div className="col-12 col-lg-10 col-xl-8 min-w-0">
										<Alert
											className="align-items-start border-0 d-flex gap-2 mb-3 px-3 py-2 shadow-sm"
											variant="info"
										>
											<span className="flex-grow-1 fw-semibold min-w-0 small text-break text-uppercase">
												One-off preview
											</span>
											<button
												aria-label="Dismiss one-off preview"
												className="btn btn-link btn-sm flex-shrink-0 lh-1 mt-n1 p-0 text-body-secondary"
												onClick={() => setCustomStat(null)}
												type="button"
											>
												<Icon type="times" />
											</button>
										</Alert>
										<div className="min-w-0 overflow-x-auto">
											<UGPTStatContainer
												game={game}
												reqUser={reqUser}
												shouldFetchCompareID={
													(shouldFetchThisUserData && user!.id) ||
													undefined
												}
												stat={customStat}
											/>
										</div>
									</div>

									<Divider className="mt-2" />
								</div>
							) : (
								<></>
							)}
							{data.reqUserData.length === 0 ? (
								<div className="py-5 px-2 text-center">
									<p className="mb-2 text-body-secondary">
										<ReferToUser reqUser={projectingStats ? user! : reqUser} />{" "}
										not configured showcase stats yet.
									</p>
									{userIsReqUser && (
										<p className="mb-0">
											<Link
												className="fw-medium"
												to={`/u/${user!.username}/games/${game}/settings`}
											>
												Configure them in settings
											</Link>
										</p>
									)}
								</div>
							) : (
								<div className="row g-4 justify-content-center">
									{data.reqUserData.map((e, i) => (
										<div className="col-12 col-sm-6 col-xl-4 d-flex" key={i}>
											<StatDisplay
												compareData={
													data.thisUserData
														? data.thisUserData[i]
														: undefined
												}
												game={game}
												reqUser={reqUser}
												statData={e}
											/>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</AsyncLoader>
			</Card>
			<UGPTStatCreator
				game={game}
				onCreate={(stat) => setCustomStat(stat)}
				reqUser={reqUser}
				setShow={setCustomShow}
				show={customShow}
			/>
		</>
	);
}

function StatDelta({
	v1,
	v2,
	mode,
	metric: property,
	game,
}: {
	game: V3Game;
	metric: string;
	mode: "chart" | "folder";
	v1: number | null;
	v2?: number | null;
}) {
	if (!v2) {
		// @warn: This means things like BPI goals can go negative and spit nonsense

		v2 = 0;
	}

	if (v1 === null) {
		v1 = 0;
	}

	const formattedV2 = FormatValue(game, mode, property, v2);

	let colour;
	if (v2 === v1) {
		colour = "warning";
	} else if (v2 > v1) {
		colour = "success";
	} else {
		colour = "danger";
	}

	let delta = null;

	// don't bother highlighting grade/lamp deltas, since they're kinda meaningless
	// unless it's a folder then always show the delta for charts that meet requirement
	if (
		property === "percent" ||
		property === "score" ||
		property === "playcount" ||
		mode === "folder"
	) {
		const d = FormatValue(game, mode, property, v2 - v1);
		delta = ` (${v2 > v1 ? `+${d}` : v2 === v1 ? `±${d}` : d})`;
	}

	return (
		<div
			className={`border-start border-4 ps-2 py-2 small text-start bg-body-secondary rounded-end showcase-stat-delta border-${colour}`}
		>
			<span className="text-body fw-medium">You: </span>
			<span className={`text-${colour}`}>
				{formattedV2}
				{delta}
			</span>
		</div>
	);
}

export function FormatValue(
	game: V3Game,
	mode: "chart" | "folder",
	metric: string,
	value: number | null,
) {
	if (mode === "chart" && metric === "playcount") {
		return value;
	}

	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, metric);

	if (!conf) {
		return "UNKNOWN METRIC";
	}

	if (value === null) {
		return "NOT PLAYED";
	}

	if (mode === "folder") {
		return value;
	}

	if (conf.type === "ENUM") {
		return conf.values[value];
	} else if (conf.type === "DECIMAL" || conf.type === "INTEGER") {
		return conf.formatter(value);
	}

	return value;
}

export function GetStatName(
	stat: ShowcaseStatDetails,
	game: V3Game,
	related: UGPTPreferenceStatsReturn["related"],
) {
	if (stat.mode === "folder") {
		return (related as { folder: FolderDocument }).folder.title;
	} else if (stat.mode === "chart") {
		const r = related as { chart: ChartDocument; song: SongDocument };
		return FormatChart(r.chart);
	}

	// @ts-expect-error yeah it's an error state lol
	throw new Error(`Unknown stat.mode ${stat.mode}`);
}

export function StatDisplay({
	statData,
	reqUser,
	compareData,
	game,
}: {
	compareData?: UGPTPreferenceStatsReturn;
	reqUser: UserDocument;
	statData: UGPTPreferenceStatsReturn;
} & GamePT) {
	const { user } = useContext(UserContext);

	if (statData.stat.mode === "chart") {
		const { stat, result, related } = statData as UGPTPreferenceChartStatsReturn;
		const { song, chart } = related;
		const { playcount, pb } = result;

		const compareChart =
			user && user.id !== reqUser.id && compareData?.stat.mode === "chart"
				? (compareData as UGPTPreferenceChartStatsReturn)
				: undefined;

		return (
			<Card
				cardBodyClassName="d-flex flex-column gap-3 text-center"
				className="h-100 stat-overview-card text-center w-100"
				header={<h5 className="mb-0 text-body-secondary">Chart</h5>}
			>
				<div className="px-1">
					<Link
						className="d-block gentle-link lh-sm text-break text-decoration-none"
						to={CreateChartLink(chart)}
					>
						<span className="fs-5 fw-semibold">{FormatChart(chart)}</span>
					</Link>
				</div>
				{pb ? (
					<div className="overflow-x-auto px-0">
						<MiniTable
							className="mb-0 showcase-pb-table table-borderless"
							colSpan={100}
							headers={["Personal best"]}
						>
							<tr>
								<ScoreCoreCells chart={chart} game={pb.game} score={pb} short />
							</tr>
						</MiniTable>
					</div>
				) : (
					<p className="fst-italic mb-0 text-body-secondary">Not played</p>
				)}
				<div className="align-items-baseline d-flex flex-wrap gap-1 justify-content-center">
					<span className="small text-body-secondary text-uppercase">Playcount</span>
					<span className="fw-semibold small tabular-nums">{playcount}</span>
				</div>
				{compareChart && (
					<div className="showcase-compare-block text-start">
						<StatDelta
							game={game}
							metric="playcount"
							mode="chart"
							v1={playcount}
							v2={compareChart.result.playcount}
						/>
						<div className="mt-3">
							<div className="fw-semibold mb-2 small text-body-secondary text-uppercase">
								Your PB
							</div>
							{compareChart.result.pb ? (
								<div className="overflow-x-auto">
									<MiniTable
										className="mb-0 showcase-pb-table table-borderless"
										colSpan={100}
									>
										<tr>
											<ScoreCoreCells
												chart={chart}
												game={compareChart.result.pb.game}
												score={compareChart.result.pb}
												short
											/>
										</tr>
									</MiniTable>
								</div>
							) : (
								<p className="fst-italic mb-0 small text-body-secondary">
									Not played
								</p>
							)}
						</div>
					</div>
				)}
			</Card>
		);
	}

	if (statData.stat.mode === "folder") {
		const { stat, result, related } = statData as UGPTPreferenceFolderStatsReturn;
		const { folder } = related;

		const headerStr = folder.title;

		return (
			<Card
				cardBodyClassName="d-flex flex-column gap-3 text-center"
				className="h-100 stat-overview-card text-center w-100"
				header={<h5 className="mb-0 text-body-secondary">Folder</h5>}
			>
				<div className="px-1">
					<Link
						className="d-block gentle-link lh-sm text-break text-decoration-none"
						to={`/u/${reqUser.username}/games/${game}/folders/${folder.slug}`}
					>
						<span className="fs-5 fw-semibold">{headerStr}</span>
					</Link>
					<p className="mb-0 mt-2 small text-body-secondary">
						<span className="fw-medium text-body">{UppercaseFirst(stat.metric)}</span> ≥{" "}
						{/* basically, FormatValue is being used for two different things here: formatting Score >= 900000 for folders, and also displaying counts of how scores in this folder match that thing. Obviously, these should get different functions, but i don't care, and you don't either, because nobody will ever read this comment, or this code, or ever care. it's fine. Everything is OK. */}
						{FormatValue(game, "chart", stat.metric, stat.gte)}
					</p>
				</div>
				<div>
					<div className="align-items-baseline d-flex flex-wrap gap-2 justify-content-center">
						<span className="fs-1 fw-bold tabular-nums">{result.value}</span>
						<span className="text-body-secondary">
							/ {result.outOf}{" "}
							<span className="small">({ToPercent(result.value, result.outOf)})</span>
						</span>
					</div>
				</div>

				{user && user.id !== reqUser.id && (
					<div className="mt-auto">
						<StatDelta
							game={game}
							metric={stat.metric}
							mode={stat.mode}
							v1={result.value}
							v2={
								compareData?.stat.mode === "folder"
									? (compareData as UGPTPreferenceFolderStatsReturn).result.value
									: undefined
							}
						/>
					</div>
				)}
			</Card>
		);
	}

	return <></>;
}
