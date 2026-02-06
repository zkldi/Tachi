import { APIFetchV1 } from "util/api";
import { CreateChartLink } from "util/data";
import { ToPercent, UppercaseFirst } from "util/misc";
import Card from "components/layout/page/Card";
import CardHeader from "components/layout/page/CardHeader";
import CardNavButton from "components/layout/page/CardNavButton";
import AsyncLoader from "components/util/AsyncLoader";
import Divider from "components/util/Divider";
import Icon from "components/util/Icon";
import ReferToUser from "components/util/ReferToUser";
import { UserContext } from "context/UserContext";
import { AllLUGPTStatsContext } from "context/AllLUGPTStatsContext";
import { nanoid } from "nanoid";
import React, { useContext, useState } from "react";
import { Alert, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	ChartDocument,
	FolderDocument,
	FormatChart,
	Game,
	GetGamePTConfig,
	UserDocument,
	ShowcaseStatDetails,
	SongDocument,
	Playtype,
	GetScoreMetricConf,
} from "tachi-common";
import { UGPTPreferenceStatsReturn } from "types/api-returns";
import { GamePT, UGPT } from "types/react";
import UGPTStatContainer from "./UGPTStatContainer";
import UGPTStatCreator from "./UGPTStatCreator";

export default function UGPTStatShowcase({ reqUser, game, playtype }: UGPT) {
	const { ugs } = useContext(AllLUGPTStatsContext);
	const { user } = useContext(UserContext);

	const [projectingStats, setProjectingStats] = useState(false);

	const hasUserPlayedGame =
		ugs && !!ugs.filter((e) => e.game === game && e.playtype === playtype).length;

	const userIsReqUser = user && user.id === reqUser.id;

	const shouldFetchThisUserData = hasUserPlayedGame && !userIsReqUser;

	const [customShow, setCustomShow] = useState(false);
	const [customStat, setCustomStat] = useState<ShowcaseStatDetails | null>(null);

	return (
		<>
			<Card
				className="bg-body-secondary bg-opacity-50"
				header={
					<CardHeader
						rightContent={
							userIsReqUser ? (
								<CardNavButton
									type="edit"
									to={`/u/${
										user!.username
									}/games/${game}/${playtype}/settings?showcase=yea`}
									hoverText="Modify your statistics showcase."
								/>
							) : null
						}
					>
						<h3>
							{projectingStats
								? `${user!.username}'s Stat Showcase (Projected onto ${
										reqUser.username
								  })`
								: `${reqUser.username}'s Stat Showcase`}
						</h3>
					</CardHeader>
				}
				footer={
					<div className="d-flex w-100 justify-content-center">
						<div className="btn-group">
							{hasUserPlayedGame &&
								!userIsReqUser &&
								(projectingStats ? (
									<OverlayTrigger
										placement="top"
										overlay={
											<Tooltip id="quick-panel-tooltip">
												Return to {reqUser.username}'s selected stats.
											</Tooltip>
										}
									>
										<div
											className="btn btn-success"
											onClick={() => setProjectingStats(false)}
										>
											<i
												className="fas fa-sync"
												style={{ paddingRight: 0 }}
											/>
										</div>
									</OverlayTrigger>
								) : (
									<OverlayTrigger
										placement="top"
										overlay={
											<Tooltip id={nanoid()}>
												Change the displayed stats to the same ones you use!
											</Tooltip>
										}
									>
										<div
											className="btn btn-outline-secondary text-body"
											onClick={() => setProjectingStats(true)}
										>
											<i
												className="fas fa-sync"
												style={{ paddingRight: 0 }}
											/>
										</div>
									</OverlayTrigger>
								))}
							<OverlayTrigger
								placement="top"
								overlay={
									<Tooltip id="quick-panel-tooltip">
										Evaluate a custom statistic.
									</Tooltip>
								}
							>
								<div
									className="btn btn-outline-secondary text-body"
									onClick={() => setCustomShow(true)}
								>
									<i
										className="fas fa-file-signature"
										style={{ paddingRight: 0 }}
									/>
								</div>
							</OverlayTrigger>
						</div>
					</div>
				}
			>
				<AsyncLoader
					promiseFn={async () => {
						const res = await APIFetchV1<UGPTPreferenceStatsReturn[]>(
							`/users/${reqUser.id}/games/${game}/${playtype}/showcase${
								projectingStats ? `?projectUser=${user!.id}` : ""
							}`
						);

						if (!res.success) {
							throw new Error(res.description);
						}

						if (shouldFetchThisUserData) {
							const res2 = await APIFetchV1<UGPTPreferenceStatsReturn[]>(
								`/users/${user!.id}/games/${game}/${playtype}/showcase${
									!projectingStats ? `?projectUser=${reqUser.id}` : ""
								}`
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
						<div className="container">
							{customStat ? (
								<div className="row justify-content-center">
									<div className="col-12 col-lg-4 lg-offset-8">
										<Alert variant="info" className="text-center">
											CUSTOM STAT{" "}
											<span className="float-end">
												<Icon
													type="times"
													onClick={() => setCustomStat(null)}
												/>
											</span>
										</Alert>
										<UGPTStatContainer
											shouldFetchCompareID={
												(shouldFetchThisUserData && user!.id) || undefined
											}
											stat={customStat}
											reqUser={reqUser}
											game={game}
											playtype={playtype}
										/>
									</div>

									<Divider className="mt-4" />
								</div>
							) : (
								<></>
							)}
							{data.reqUserData.length === 0 ? (
								<div className="row">
									<div className="col-12 text-center">
										<ReferToUser reqUser={projectingStats ? user! : reqUser} />{" "}
										no stats configured.
									</div>
									{userIsReqUser && (
										<div className="col-12 mt-2 text-center">
											Why not{" "}
											<Link
												to={`/u/${
													user!.username
												}/games/${game}/${playtype}/settings`}
											>
												Set Some?
											</Link>
										</div>
									)}
								</div>
							) : (
								<div className="row justify-content-center">
									{data.reqUserData.map((e, i) => (
										<div
											key={i}
											className="col-12 col-md-4 d-flex align-items-stretch mt-8"
										>
											<StatDisplay
												reqUser={reqUser}
												statData={e}
												compareData={
													data.thisUserData
														? data.thisUserData[i]
														: undefined
												}
												game={game}
												playtype={playtype}
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
				show={customShow}
				setShow={setCustomShow}
				game={game}
				playtype={playtype}
				onCreate={(stat) => setCustomStat(stat)}
				reqUser={reqUser}
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
	playtype,
}: {
	v1: number | null;
	v2?: number | null;
	mode: "folder" | "chart";
	metric: string;
	game: Game;
	playtype: Playtype;
}) {
	if (!v2) {
		// @warn: This means things like BPI goals can go negative and spit nonsense
		// eslint-disable-next-line no-param-reassign
		v2 = 0;
	}

	if (v1 === null) {
		// eslint-disable-next-line no-param-reassign
		v1 = 0;
	}

	const formattedV2 = FormatValue(game, playtype, mode, property, v2);

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
		const d = FormatValue(game, playtype, mode, property, v2 - v1);
		delta = ` (${v2 > v1 ? `+${d}` : v2 === v1 ? `±${d}` : d})`;
	}

	return (
		<div className={`mt-2 text-${colour}`}>
			<span>You: {formattedV2}</span>
			{delta}
		</div>
	);
}

export function FormatValue(
	game: Game,
	playtype: Playtype,
	mode: "folder" | "chart",
	metric: string,
	value: number | null
) {
	if (mode === "chart" && metric === "playcount") {
		return value;
	}

	const gptConfig = GetGamePTConfig(game, playtype);
	const conf = GetScoreMetricConf(gptConfig, metric);

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
	game: Game,
	related: UGPTPreferenceStatsReturn["related"]
) {
	if (stat.mode === "folder") {
		return (related as { folder: FolderDocument }).folder.title;
	} else if (stat.mode === "chart") {
		const r = related as { song: SongDocument; chart: ChartDocument };
		return FormatChart(game, r.song, r.chart);
	}

	// @ts-expect-error yeah it's an error state lol
	throw new Error(`Unknown stat.mode ${stat.mode}`);
}

export function StatDisplay({
	statData,
	reqUser,
	compareData,
	game,
	playtype,
}: {
	statData: UGPTPreferenceStatsReturn;
	compareData?: UGPTPreferenceStatsReturn;
	reqUser: UserDocument;
} & GamePT) {
	const { stat, result, related } = statData;
	const { user } = useContext(UserContext);

	if (stat.mode === "chart") {
		const { song, chart } = related as { song: SongDocument; chart: ChartDocument };

		return (
			<Card
				className="text-center stat-overview-card w-100 flex-grow-1"
				header={<h5 className="text-body-secondary mb-0">Chart</h5>}
			>
				<>
					<Link className="text-decoration-none" to={CreateChartLink(chart, game)}>
						<h4>{FormatChart(game, song, chart, true)}</h4>
					</Link>
					<h4>
						{UppercaseFirst(stat.metric)}:{" "}
						{FormatValue(game, playtype, stat.mode, stat.metric, result.value)}
					</h4>
					{user && user.id !== reqUser.id && (
						<StatDelta
							v1={statData.result.value}
							v2={compareData?.result.value}
							mode={stat.mode}
							metric={stat.metric}
							game={game}
							playtype={playtype}
						/>
					)}
				</>
			</Card>
		);
	} else if (stat.mode === "folder") {
		const { folder } = related as { folder: FolderDocument };

		const headerStr = folder.title;

		return (
			<Card
				className="text-center stat-overview-card w-100"
				header={<h5 className="text-body-secondary mb-0">Folder</h5>}
			>
				<>
					<Link
						className="text-decoration-none"
						to={`/u/${reqUser.id}/games/${game}/${playtype}/folders/${folder.folderID}`}
					>
						<h4>{headerStr}</h4>
					</Link>
					<h5>
						{UppercaseFirst(stat.metric)} &gt;={" "}
						{/* basically, FormatValue is being used for two different things here: formatting Score >= 900000 for folders, and also displaying counts of how scores in this folder match that thing. Obviously, these should get different functions, but i don't care, and you don't either, because nobody will ever read this comment, or this code, or ever care. it's fine. Everything is OK. */}
						{FormatValue(game, playtype, "chart", stat.metric, stat.gte)}
					</h5>
					<h4>
						{result.value}
						<small className="text-body-secondary">
							{/* @ts-expect-error This property definitely exists.*/}
							{/* */}/{result.outOf} ({ToPercent(result.value, result.outOf)})
						</small>
					</h4>

					{user && user.id !== reqUser.id && (
						<StatDelta
							v1={statData.result.value}
							v2={compareData?.result.value}
							mode={stat.mode}
							metric={stat.metric}
							game={game}
							playtype={playtype}
						/>
					)}
				</>
			</Card>
		);
	}

	return <></>;
}
