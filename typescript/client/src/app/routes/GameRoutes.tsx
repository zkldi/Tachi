import GPTChartPage from "#app/pages/dashboard/games/_game/_playtype/GPTChartPage";
import GPTChartsPage from "#app/pages/dashboard/games/_game/_playtype/GPTChartsPage";
import GPTDevInfo from "#app/pages/dashboard/games/_game/_playtype/GPTDevInfo";
import GPTLeaderboardsPage from "#app/pages/dashboard/games/_game/_playtype/GPTLeaderboardsPage";
import GPTMainPage from "#app/pages/dashboard/games/_game/_playtype/GPTMainPage";
import { ErrorPage } from "#app/pages/ErrorPage";
import ChartInfoFormat from "#components/game/charts/ChartInfoFormat";
import { GPTBottomNav } from "#components/game/GPTHeader";
import SongChartInfoFormat from "#components/game/songs/SongChartInfoFormat";
import QuestlinePage from "#components/game/targets/QuestlinePage";
import QuestPage from "#components/game/targets/QuestPage";
import QuestsPage from "#components/game/targets/QuestsPage";
import Card from "#components/layout/page/Card";
import DebugContent from "#components/util/DebugContent";
import Divider from "#components/util/Divider";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import useLUGPTSettings from "#components/util/useLUGPTSettings";
import { BackgroundContext } from "#context/BackgroundContext";
import { TargetsContextProvider } from "#context/TargetsContext";
import { UGPTContextProvider } from "#context/UGPTContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type SongsReturn } from "#types/api-returns";
import { type GamePT, type SetState } from "#types/react";
import { ToCDNURL } from "#util/api";
import { IsSupportedGame } from "#util/asserts";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartLink } from "#util/data";
import { getGameGroupBannerRelPathForWeekday } from "#util/game-group-banner-counts";
import { SelectRightChart } from "#util/misc";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, { useContext, useEffect, useState } from "react";
import { Col, Row } from "react-bootstrap";
import { Redirect, Route, Switch, useParams } from "react-router-dom";
import {
	type ChartDocument,
	COLOUR_SET,
	FormatDifficultyLong,
	type GamesForGroup,
	GameToGameGroup,
	GetGameConfig,
	type SongDocument,
	type V3Game,
} from "tachi-common";
import {
	type ChuGekiMaiDifficulties,
	type FixedDifficulties,
} from "tachi-common/types/game-config-utils";

export default function GameRoutes() {
	// Support legacy URLs like /games/iidx/SP → redirect to /games/iidx-sp
	return (
		<Switch>
			<Route path="/games/:game">
				<V3GameRoutes />
			</Route>
		</Switch>
	);
}

function V3GameRoutes() {
	const { game: gameParam } = useParams<{ game: string }>();
	const { setBackground } = useContext(BackgroundContext);

	useEffect(() => {
		if (!IsSupportedGame(gameParam)) {
			setBackground(null);
			return;
		}
		setBackground(ToCDNURL(getGameGroupBannerRelPathForWeekday(GameToGameGroup(gameParam))));
	}, [gameParam, setBackground]);

	if (!IsSupportedGame(gameParam)) {
		return (
			<ErrorPage customMessage={`The game ${gameParam} is not supported.`} statusCode={404} />
		);
	}

	const game = gameParam;

	return (
		<UGPTContextProvider>
			<TargetsContextProvider>
				<GameV3Routes game={game} />
			</TargetsContextProvider>
		</UGPTContextProvider>
	);
}

function GameV3Routes({ game }: { game: V3Game }) {
	return (
		<>
			<div className="card">
				<GPTBottomNav baseUrl={`/games/${game}`} />
			</div>
			<Divider />
			<Switch>
				<Route exact path="/games/:game">
					<GPTMainPage game={game} />
				</Route>

				<Route exact path="/games/:game/songs">
					<Redirect to={`/games/${game}/charts`} />
				</Route>

				<Route exact path="/games/:game/charts">
					<GPTChartsPage game={game} />
				</Route>

				<Route path="/games/:game/charts/:chartID">
					<ChartPageRoutes game={game} />
				</Route>

				<Route path="/games/:game/songs/:songID">
					<SongChartRedirectRoutes game={game} />
				</Route>

				<Route path="/games/:game/(quests|questlines|goals)">
					<GPTQuestRoutes game={game} />
				</Route>

				<Route exact path="/games/:game/leaderboards">
					<GPTLeaderboardsPage game={game} />
				</Route>
				<Route exact path="/games/:game/dev-info">
					<GPTDevInfo game={game} />
				</Route>

				<Route path="*">
					<ErrorPage statusCode={404} />
				</Route>
			</Switch>
		</>
	);
}

function GPTQuestRoutes({ game }: GamePT) {
	return (
		<>
			<Switch>
				<Route exact path="/games/:game/quests">
					<QuestsPage game={game} />
				</Route>

				<Route exact path="/games/:game/questlines">
					<Redirect to={`/games/${game}/quests`} />
				</Route>

				<Route exact path="/games/:game/questlines/:questlineID">
					<QuestlinePage game={game} />
				</Route>

				<Route exact path="/games/:game/quests/:questID">
					<QuestPage game={game} />
				</Route>

				<Route exact path="/games/:game/goals">
					<Redirect to={`/games/${game}/quests`} />
				</Route>
			</Switch>
		</>
	);
}

function ChartPageRoutes({ game }: GamePT) {
	const { chartID } = useParams<{ chartID: string }>();

	const { data: singleData, error: chartErr } = useApiQuery<{
		chart: ChartDocument;
		song: SongDocument;
	}>(`/games/${game}/charts/${chartID}`);

	const songLegacyId = singleData?.song.id;

	const { data: songsData, error: songsErr } = useApiQuery<SongsReturn>(
		songLegacyId !== undefined ? `/games/${game}/songs/${songLegacyId}` : "",
		undefined,
		undefined,
		songLegacyId === undefined,
	);

	const { settings } = useContext(UserSettingsContext);

	const [activeChart, setActiveChart] = useState<ChartDocument | null>(null);

	useEffect(() => {
		const c = songsData?.charts.find((x) => x.chartID === chartID);
		setActiveChart(c ?? singleData?.chart ?? null);
	}, [chartID, songsData, singleData]);

	const error = chartErr ?? songsErr;

	if (error) {
		return <ErrorPage customMessage={error.description} statusCode={error.statusCode} />;
	}

	if (!singleData || !songsData) {
		return <Loading />;
	}

	if (songsData.charts.length === 0) {
		return (
			<ErrorPage customMessage={"This song has no charts for this game."} statusCode={404} />
		);
	}

	return (
		<>
			<SongInfoHeader
				game={game}
				{...songsData}
				activeChart={activeChart}
				setActiveChart={setActiveChart}
			/>
			<Divider />
			<GPTChartPage chart={activeChart} game={game} song={songsData.song} />
			{settings?.preferences.developerMode && (
				<>
					<Divider />
					<Card header="Dev Info">
						<DebugContent data={songsData} />
					</Card>
				</>
			)}
		</>
	);
}

function SongChartRedirectRoutes({ game }: GamePT) {
	const { songID } = useParams<{ songID: string }>();

	const { data, error } = useApiQuery<SongsReturn>(`/games/${game}/songs/${songID}`);

	if (error) {
		return <ErrorPage customMessage={error.description} statusCode={error.statusCode} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (data.charts.length === 0) {
		return (
			<ErrorPage customMessage={"This song has no charts for this game."} statusCode={404} />
		);
	}

	if (data.charts.every((c) => c.game !== game)) {
		const c = data.charts[0];

		if (!c.chartID) {
			return (
				<ErrorPage
					customMessage={"This song has no chart IDs for navigation."}
					statusCode={500}
				/>
			);
		}

		return <Redirect to={`/games/${c.game}/charts/${c.chartID}`} />;
	}

	return (
		<Switch>
			<Route exact path="/games/:game/songs/:songID">
				<SongSongIdOnlyRedirect charts={data.charts} game={game} />
			</Route>

			<Route path="/games/:game/songs/:songID/:difficulty">
				<SongDifficultyRedirect data={data} game={game} />
			</Route>

			<Route path="*">
				<ErrorPage statusCode={404} />
			</Route>
		</Switch>
	);
}

function SongSongIdOnlyRedirect({ charts, game }: { charts: ChartDocument[] } & GamePT) {
	const hardest = charts.slice(0).sort(NumericSOV((x) => x.levelNum, true))[0];

	if (!hardest.chartID) {
		return (
			<ErrorPage
				customMessage={"This song has no chart IDs for navigation."}
				statusCode={500}
			/>
		);
	}

	return <Redirect to={`/games/${game}/charts/${hardest.chartID}`} />;
}

function SongDifficultyRedirect({ data, game }: { data: SongsReturn } & GamePT) {
	const { difficulty: d } = useParams<{ difficulty: string }>();
	const difficulty = decodeURIComponent(d);

	const gameConfig = GetGameConfig(game);
	const chart = SelectRightChart(gameConfig, difficulty, data.charts);

	if (!chart?.chartID) {
		return <ErrorPage customMessage={"Could not resolve this chart."} statusCode={404} />;
	}

	return <Redirect to={`/games/${chart.game}/charts/${chart.chartID}`} />;
}

function SongInfoHeader({
	game,
	song,
	charts,
	activeChart,
	setActiveChart,
}: {
	activeChart: ChartDocument | null;
	setActiveChart: SetState<ChartDocument | null>;
} & GamePT &
	SongsReturn) {
	const gameConfig = GetGameConfig(game);
	const sortedCharts = charts.slice(0);

	if (gameConfig.difficulties.type === "DYNAMIC") {
		sortedCharts.sort(StrSOV((x) => x.difficulty));
	} else if (gameConfig.difficulties.type === "CHUGEKIMAI_STYLE") {
		const difficulties = gameConfig.difficulties as ChuGekiMaiDifficulties<string>;

		sortedCharts.sort((a, b) => {
			const difficultyIndexA = difficulties.order.indexOf(a.difficulty);
			const difficultyIndexB = difficulties.order.indexOf(b.difficulty);

			// if both difficulties are from the fixed set, order by fixed set
			if (difficultyIndexA !== -1 && difficultyIndexB !== -1) {
				return difficultyIndexA - difficultyIndexB;
			}

			// if both difficulties are not from the fixed set, order by difficulty name
			if (difficultyIndexA === -1 && difficultyIndexB === -1) {
				return a.difficulty.localeCompare(b.difficulty);
			}

			// prefer difficulties from the fixed set
			if (difficultyIndexA === -1) {
				return 1;
			}

			return -1;
		});
	} else {
		const difficulties = gameConfig.difficulties as FixedDifficulties<string>;

		sortedCharts.sort(NumericSOV((x) => difficulties.order.indexOf(x.difficulty)));
	}

	const gameGroup = GameToGameGroup(game);

	return (
		<Card header="Song Info">
			<Row className="align-items-center justify-content-evenly">
				{gameGroup !== "bms" && gameGroup !== "pms" && (
					<Col className="text-center" lg={3} xs={12}>
						{/* empty padding :) */}
					</Col>
				)}
				<Col className="text-center" lg={4} xs={12}>
					<SongChartInfoFormat {...{ game, song, chart: activeChart }} />
				</Col>
				{gameGroup !== "bms" && gameGroup !== "pms" && (
					<Col className="text-center" lg={3} xs={12}>
						<h5>Charts</h5>
						<hr />
						<div
							className="btn-group-vertical d-flex justify-content-center"
							role="group"
						>
							{gameGroup === "iidx" ? (
								<IIDXDifficultyList
									{...{
										activeChart,
										charts: sortedCharts,
										game,
										setActiveChart,
										song,
									}}
								/>
							) : (
								<DifficultyList
									{...{
										activeChart,
										charts: sortedCharts,
										game,
										setActiveChart,
										song,
									}}
								/>
							)}
						</div>
					</Col>
				)}
				{activeChart && (
					<Col xs={12}>
						<hr />
						<ChartInfoFormat chart={activeChart} game={game} song={song} />
					</Col>
				)}
			</Row>
		</Card>
	);
}

type Props = {
	activeChart: ChartDocument | null;
	setActiveChart: SetState<ChartDocument | null>;
} & { song: SongDocument } & GamePT;

const ITG_COLOUR_LOOKUP = {
	Beginner: COLOUR_SET.paleBlue,
	Easy: COLOUR_SET.green,
	Medium: COLOUR_SET.vibrantYellow,
	Hard: COLOUR_SET.red,
	Expert: COLOUR_SET.pink,
	Edit: COLOUR_SET.gray,
};

function DifficultyButton({
	chart,
	game,
	setActiveChart,
	activeChart,
}: { chart: ChartDocument } & Props) {
	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	const diffTag = chart.difficulty;
	const gameGroup = GameToGameGroup(game);

	return (
		<LinkButton
			className="text-body"
			key={chart.chartID}
			onClick={() => setActiveChart(chart)}
			style={{
				// @ts-expect-error hack!
				backgroundColor: gptImpl.difficultyColours[diffTag]
					? ChangeOpacity(
							// @ts-expect-error hack!
							gptImpl.difficultyColours[diffTag],
							activeChart?.chartID === chart.chartID ? 0.4 : 0.2,
						)
					: gameGroup === "itg"
						? ChangeOpacity(
								// @ts-expect-error hack!
								ITG_COLOUR_LOOKUP[chart.data.difficultyTag],
								activeChart?.chartID === chart.chartID ? 0.4 : 0.2,
							)
						: undefined,
			}}
			to={CreateChartLink(chart)}
			variant="secondary"
		>
			<div
				className={activeChart?.chartID === chart.chartID ? "fw-bolder" : ""}
				style={{
					color:
						gameGroup === "ongeki" && diffTag === "LUNATIC"
							? "light-dark(rgba(140, 30, 40, 1), rgba(255, 180, 180, 1))"
							: undefined,
				}}
			>
				{FormatDifficultyLong(chart)}
				{chart.isPrimary ? (
					""
				) : (
					<>
						{" "}
						<Muted>{chart.versions.join("/")}</Muted>
					</>
				)}
			</div>
		</LinkButton>
	);
}

function DifficultyList({
	charts,
	song,
	activeChart,
	setActiveChart,
	game,
}: {
	charts: ChartDocument[];
} & Props) {
	return (
		<>
			{charts.map((e) => (
				<DifficultyButton
					activeChart={activeChart}
					chart={e}
					game={game}
					key={e.chartID}
					setActiveChart={setActiveChart}
					song={song}
				/>
			))}
		</>
	);
}

/**
 * We need some special handling for IIDX Special Difficulties.
 * Thanks.
 */
function IIDXDifficultyList({
	charts,
	song,
	activeChart,
	setActiveChart,
	game,
}: {
	charts: ChartDocument[];
} & Props) {
	const { settings } = useLUGPTSettings<GamesForGroup["iidx"]>();

	const [set, setSet] = useState<"All Scratch" | "Kichiku" | "Kiraku" | null>(null);

	if (
		!(activeChart as ChartDocument<GamesForGroup["iidx"]>)?.data["2dxtraSet"] &&
		!settings?.preferences.gameSpecific.display2DXTra
	) {
		return (
			<DifficultyList
				{...{
					charts: charts.filter(
						// @ts-expect-error hack
						(e: ChartDocument<GamesForGroup["iidx"]>) => e.data["2dxtraSet"] === null,
					),
					song,
					activeChart,
					setActiveChart,
					game,
				}}
			/>
		);
	}

	return (
		<>
			<div className="btn-group">
				<SelectButton id={null} setValue={setSet} value={set}>
					Normal
				</SelectButton>
				<SelectButton id="All Scratch" setValue={setSet} value={set}>
					All Scr.
				</SelectButton>
				<SelectButton id="Kichiku" setValue={setSet} value={set}>
					Kichiku
				</SelectButton>
				<SelectButton id="Kiraku" setValue={setSet} value={set}>
					Kiraku
				</SelectButton>
			</div>
			<DifficultyList
				{...{
					charts: charts.filter(
						// @ts-expect-error hack
						(e: ChartDocument<GamesForGroup["iidx"]>) =>
							set ? e.difficulty.startsWith(set) : e.data["2dxtraSet"] === null,
					),
					song,
					activeChart,
					setActiveChart,
					game,
				}}
			/>
		</>
	);
}
