import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import MiniTable from "#components/tables/components/MiniTable";
import TargetInfo from "#components/tables/dropdowns/components/TargetInfo";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import PBTable from "#components/tables/pbs/PBTable";
import ProfilePicture from "#components/user/ProfilePicture";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectLinkButton from "#components/util/SelectLinkButton";
import useLUGPTSettings from "#components/util/useLUGPTSettings";
import { TargetsContext } from "#context/TargetsContext";
import { UserContext } from "#context/UserContext";
import { WindowContext } from "#context/WindowContext";
import {
	type ChartPBLeaderboardReturn,
	type ChartRivalsReturn,
	type GoalsOnChartReturn,
	type UGPTChartLeaderboardAdjacent,
} from "#types/api-returns";
import { type GamePT } from "#types/react";
import { type PBDataset } from "#types/tables";
import { APIFetchV1, type UnsuccessfulAPIFetchResponse } from "#util/api";
import { CreateChartLink, CreateUserMap } from "#util/data";
import { MillisToSince } from "#util/time";
import React, { useContext, useMemo, useState } from "react";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Stack from "react-bootstrap/Stack";
import { useQuery } from "react-query";
import { Link, Route, Switch } from "react-router-dom";
import {
	type ChartDocument,
	FormatDifficultyLong,
	GameToGameGroup,
	GetGameGroupConfig,
	type integer,
	type PBScoreDocument,
	type SongDocument,
	type UserDocument,
} from "tachi-common";

export default function GPTChartPage({
	chart,
	game,
	song,
}: {
	chart: ChartDocument | null;
	song: SongDocument;
} & GamePT) {
	const formatSongTitle = `${song.artist} - ${song.title}`;
	const formatDiff = chart ? FormatDifficultyLong(chart) : "Loading...";

	useSetSubheader(
		[
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Songs",
			formatSongTitle,
			formatDiff,
		],
		[game, chart],
		`${formatSongTitle} (${formatDiff})`,
	);

	if (!chart) {
		return <Loading />;
	}

	return <InternalGPTChartPage chart={chart} game={game} song={song} />;
}

interface ChartPBData {
	leaderboard: ChartPBLeaderboardReturn;
	adjacent?: UGPTChartLeaderboardAdjacent;
	rivals?: ChartRivalsReturn;
}

function InternalGPTChartPage({
	chart,
	game,
	song,
}: {
	chart: ChartDocument;
	song: SongDocument;
} & GamePT) {
	const { user } = useContext(UserContext);

	const { data, error } = useQuery<ChartPBData, UnsuccessfulAPIFetchResponse>(
		["PBInfo", chart.chartID],
		async () => {
			const lRes = await APIFetchV1<ChartPBLeaderboardReturn>(
				`/games/${game}/charts/${chart.chartID}/pbs`,
			);

			if (!lRes.success) {
				throw lRes;
			}

			if (user) {
				const nRes = await APIFetchV1<UGPTChartLeaderboardAdjacent>(
					`/users/${user.id}/games/${game}/pbs/${chart.chartID}/leaderboard-adjacent`,
				);

				const rRes = await APIFetchV1<ChartRivalsReturn>(
					`/users/${user.id}/games/${game}/pbs/${chart.chartID}/rivals`,
				);

				const returnValue: ChartPBData = {
					leaderboard: lRes.body,
				};

				if (nRes.success) {
					returnValue.adjacent = nRes.body;
				}

				if (rRes.success) {
					returnValue.rivals = rRes.body;
				}

				return returnValue;
			}

			return { leaderboard: lRes.body };
		},
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (data.leaderboard.pbs.length === 0) {
		return <div className="text-center my-8">Nobody has played this chart!</div>;
	}

	const userMap = CreateUserMap(data.leaderboard.users);

	if (data.adjacent) {
		for (const user of data.adjacent.users) {
			userMap.set(user.id, user);
		}
	}

	if (data.rivals) {
		for (const user of data.rivals.rivals) {
			userMap.set(user.id, user);
		}
	}

	if (user) {
		userMap.set(user.id, user);
	}

	const base = CreateChartLink(chart);

	return (
		<>
			<Row className="row-gap-4" lg={{ cols: 2 }} xs={{ cols: 1 }}>
				<ButtonGroup className="d-flex w-100">
					<SelectLinkButton className="text-wrap" to={base}>
						<Icon type="trophy" /> Best 100
					</SelectLinkButton>
					<SelectLinkButton
						className="text-wrap"
						disabled={!data.adjacent}
						to={`${base}/me`}
					>
						<Icon type="user" /> Your Position
					</SelectLinkButton>
					{user && (
						<>
							<SelectLinkButton
								className="text-wrap"
								disabled={!data.adjacent}
								to={`${base}/rivals`}
							>
								<Icon type="users" /> Vs. Rivals
							</SelectLinkButton>
							<SelectLinkButton className="text-wrap" to={`${base}/targets`}>
								<Icon type="scroll" /> Goals & Quests
							</SelectLinkButton>
						</>
					)}
				</ButtonGroup>

				<TopShowcase chart={chart} data={data} user={user} userMap={userMap} />
			</Row>
			<div className="mt-4">
				<Switch>
					<Route exact path="/games/:game/charts/:chartID/targets">
						<ChartTargetInfo {...{ chart, game, song, user: user! }} />
					</Route>

					<Route exact path="/games/:game/charts/:chartID">
						<ChartLeaderboardTable
							{...{
								data,
								game,
								user,
								userMap,
								chart,
								song,
								mode: "leaderboard",
							}}
						/>
					</Route>

					<Route exact path="/games/:game/charts/:chartID/me">
						<ChartLeaderboardTable
							{...{
								data,
								game,
								user,
								userMap,
								chart,
								song,
								mode: "adjacent",
							}}
						/>
					</Route>

					<Route exact path="/games/:game/charts/:chartID/rivals">
						<ChartLeaderboardTable
							{...{
								data,
								game,
								user,
								userMap,
								chart,
								song,
								mode: "rivals",
							}}
						/>
					</Route>
				</Switch>
			</div>
		</>
	);
}

function ChartTargetInfo({
	user,
	game,
	chart,
	song,
}: {
	chart: ChartDocument;
	song: SongDocument;
	user: UserDocument;
} & GamePT) {
	const { reloadTargets } = useContext(TargetsContext);
	const [shouldReload, setShouldReload] = useState(0);

	const { error, data } = useApiQuery<GoalsOnChartReturn>(
		`/users/${user.id ?? ""}/games/${game}/targets/on-chart/${chart.chartID}`,
		undefined,
		[shouldReload.toString()],
	);

	return (
		<div className="w-100 text-center">
			<Divider />
			<TargetInfo
				{...{
					chart,
					data,
					error,
					game,
					reqUser: user,
					song,
					onGoalSet: () => {
						setShouldReload(shouldReload + 1);
						reloadTargets();
					},
				}}
			/>
		</div>
	);
}

function ChartLeaderboardTable({
	data,
	userMap,
	user: _user,
	game,
	mode,
	chart,
	song,
}: {
	chart: ChartDocument;
	data: ChartPBData;
	mode: "adjacent" | "leaderboard" | "rivals";
	song: SongDocument;
	user: UserDocument | null;
	userMap: Map<integer, UserDocument>;
} & GamePT) {
	const { settings } = useLUGPTSettings();

	const dataset: PBDataset = useMemo(() => {
		const ds: PBDataset = [];

		let pbs: Array<PBScoreDocument> = [];
		if (mode === "leaderboard") {
			pbs = data.leaderboard.pbs;
		} else if (mode === "adjacent") {
			pbs = [
				...data.adjacent!.adjacentAbove,
				data.adjacent!.pb,
				...data.adjacent!.adjacentBelow,
			];
		} else if (mode === "rivals") {
			pbs = data.rivals!.pbs;
		}

		for (const pb of pbs) {
			ds.push({
				...pb,
				__related: {
					chart,
					song,
					index: pb.rankingData.rank - 1,
					user: userMap.get(pb.userID)!,
				},
			});
		}

		return ds;
	}, [data, mode, userMap, chart, song]);

	return (
		<PBTable
			alg={settings?.preferences.preferredScoreAlg ?? undefined}
			dataset={dataset}
			defaultRankingViewMode={mode === "rivals" ? "global-no-switch" : "both-if-self"}
			game={game}
			key={mode}
			showChart={false}
			showUser
		/>
	);
}

function TopShowcase({
	data,
	user,
	userMap,
	chart,
}: {
	chart: ChartDocument;
	data: ChartPBData;
	user: UserDocument | null;
	userMap: Map<integer, UserDocument>;
}) {
	const bestPlay = data.leaderboard.pbs[0]!;
	const bestUser = userMap.get(bestPlay.userID)!;

	if (user?.id === bestPlay.userID) {
		return (
			<Col xs={12}>
				<PlayCard chart={chart} name="Best PB" pb={bestPlay} user={bestUser} />
			</Col>
		);
	}

	if (!data.adjacent) {
		return (
			<>
				<Col className="d-grid">
					<PlayCard chart={chart} name="Best PB" pb={bestPlay} user={bestUser} />
				</Col>
				<Col className="d-grid">
					<Card className="text-center" header="Your PB">
						<Muted>You've not played this chart.</Muted>
					</Card>
				</Col>
			</>
		);
	}

	const thisUsersPlay = data.adjacent.pb;

	return (
		<>
			<Col className="d-grid">
				<PlayCard chart={chart} name="Best Play" pb={bestPlay} user={bestUser} />
			</Col>
			<Col className="d-grid">
				<PlayCard chart={chart} name="Your PB" pb={thisUsersPlay} user={user!} />
			</Col>
		</>
	);
}

function PlayCard({
	pb,
	user,
	name,
	chart,
}: {
	chart: ChartDocument;
	name: string;
	pb: PBScoreDocument;
	user: UserDocument;
}) {
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);
	const pbGame = pb.game;
	return (
		<Card cardBodyClassName="vstack gap-4" header={name}>
			<Stack
				className="flex-grow-1 align-items-lg-start align-items-center  justify-content-around"
				direction={isLg ? "horizontal" : "vertical"}
			>
				<ProfilePicture toGPT={{ game: pbGame }} user={user} />
				<div
					className="d-flex flex-column align-self-stretch justify-content-between align-items-center"
					style={{ maxHeight: 128, minWidth: 256 }}
				>
					<Link
						className="text-decoration-none fs-4 fw-bold text-break text-center"
						to={`/u/${user.username}/games/${pbGame}`}
					>
						{user.username}
					</Link>
					<div>
						<strong className="display-3">#{pb.rankingData.rank}</strong>
						<span className="text-body-secondary display-6">
							/{pb.rankingData.outOf}
						</span>
					</div>
				</div>
			</Stack>

			<Col>
				<MiniTable colSpan={100} headers={["PB Info"]}>
					<tr>
						<ScoreCoreCells chart={chart} game={pbGame} score={pb} short />
					</tr>
				</MiniTable>
				<div className="text-center">
					<Muted>
						{pb.timeAchieved
							? (MillisToSince(pb.timeAchieved) ?? "")
							: "No Timestamp Info"}
					</Muted>
				</div>
			</Col>
		</Card>
	);
}
