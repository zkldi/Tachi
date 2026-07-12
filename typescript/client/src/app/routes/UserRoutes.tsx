import FoldersMainPage from "#app/pages/dashboard/users/games/_game/_playtype/folders/FoldersMainPage";
import LeaderboardsPage from "#app/pages/dashboard/users/games/_game/_playtype/LeaderboardsPage";
import OverviewPage from "#app/pages/dashboard/users/games/_game/_playtype/OverviewPage";
import RivalsMainPage from "#app/pages/dashboard/users/games/_game/_playtype/rivals/RivalsMainPage";
import SessionsPage from "#app/pages/dashboard/users/games/_game/_playtype/SessionsPage";
import SpecificSessionPage from "#app/pages/dashboard/users/games/_game/_playtype/SpecificSessionPage";
import TargetsPage from "#app/pages/dashboard/users/games/_game/_playtype/targets/TargetsPage";
import UserGameSettingsPage from "#app/pages/dashboard/users/games/_game/_playtype/UserGameSettingsPage";
import UserGameUtilsPage from "#app/pages/dashboard/users/games/_game/_playtype/utils/UserGameUtilsPage";
import UserGamesPage from "#app/pages/dashboard/users/UserGamesPage";
import UserImportsPage from "#app/pages/dashboard/users/UserImportsPage";
import UserIntegrationsPage from "#app/pages/dashboard/users/UserIntegrationsPage";
import UserInvitesPage from "#app/pages/dashboard/users/UserInvitesPage";
import UserOrphansPage from "#app/pages/dashboard/users/UserOrphansPage";
import UserSettingsPage from "#app/pages/dashboard/users/UserSettingsPage";
import ErrorPage from "#app/pages/ErrorPage";
import RequireAuthAsUserParam from "#components/auth/RequireAuthAsUserParam";
import LayoutHeaderContainer from "#components/layout/LayoutHeaderContainer";
import { UserGameHeaderBody, UserGameNav } from "#components/user/UserGameHeader";
import { UserBottomNav, UserHeaderBody } from "#components/user/UserHeader";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { BackgroundContext } from "#context/BackgroundContext";
import { TargetsContextProvider } from "#context/TargetsContext";
import { UserContext } from "#context/UserContext";
import { UserGameContextProvider } from "#context/UserGameContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { type UserGameStatsReturn } from "#types/api-returns";
import { APIFetchV1, type APIFetchV1Return, ToAPIURL } from "#util/api";
import { IsSupportedGame } from "#util/asserts";
import { useContext, useEffect } from "react";
import { useQuery } from "react-query";
import { Redirect, Route, Switch, useHistory, useParams } from "react-router-dom";
import { FormatGame, type UserDocument, type UserGameStats, type V3Game } from "tachi-common";

import ScoresPage from "../pages/dashboard/users/games/_game/_playtype/ScoresPage";
import UserPage from "../pages/dashboard/users/UserPage";

export default function UserRoutes() {
	const params = useParams<{ userID: string }>();
	const { userID } = useParams<{ userID: string }>();
	const history = useHistory();

	const { data: reqUser, error } = useApiQuery<UserDocument>(`/users/${params.userID}`);

	const { setBackground } = useContext(BackgroundContext);
	useEffect(() => {
		if (reqUser) {
			setBackground(ToAPIURL(`/users/${reqUser.id}/banner`));
		}

		return () => {
			setBackground(null);
		};
	}, [reqUser]);

	if (error && error.statusCode === 404) {
		return <ErrorPage customMessage="This user does not exist!" statusCode={404} />;
	}

	if (error) {
		return <ErrorPage customMessage={error.description} statusCode={error.statusCode} />;
	}

	if (!reqUser) {
		return null;
	}

	// redirect to the users actual name if using a user ID or "me"
	if (userID.match(/^([0-9]+|me)$/u)) {
		const split = history.location.pathname.match(/^(\/u)\/([0-9]+|me)(.*)$/u);

		if (!split) {
			return (
				<ErrorPage
					customMessage="I mean, this might be my fault. It might be yours. How the hell did you get here? (REPORT THIS!)"
					statusCode={404}
				/>
			);
		}

		const newPath = `${split[1]}/${reqUser.username}${split[3]}`;

		return <Redirect to={newPath} />;
	}

	return (
		<Switch>
			<Route path="/u/:userID">
				<Switch>
					<Route path="/u/:userID/games/:game">
						<UserGameRoutes reqUser={reqUser} />
					</Route>
					<UserProfileRoutes reqUser={reqUser} />
				</Switch>
			</Route>
		</Switch>
	);
}

function UserProfileRoutes({ reqUser }: { reqUser: UserDocument }) {
	const { settings } = useContext(UserSettingsContext);

	return (
		<>
			<LayoutHeaderContainer
				footer={<UserBottomNav baseUrl={`/u/${reqUser.username}`} reqUser={reqUser} />}
				header={
					settings?.preferences.developerMode
						? `${reqUser.username} (UID: ${reqUser.id})`
						: `${reqUser.username}'s Profile`
				}
			>
				<UserHeaderBody reqUser={reqUser} />
			</LayoutHeaderContainer>
			<Route exact path="/u/:userID">
				<UserPage reqUser={reqUser} />
			</Route>
			<Route exact path="/u/:userID/games">
				<UserGamesPage reqUser={reqUser} />
			</Route>
			<Route exact path="/u/:userID/settings">
				<RequireAuthAsUserParam>
					<UserSettingsPage reqUser={reqUser} />
				</RequireAuthAsUserParam>
			</Route>
			<Route path="/u/:userID/integrations">
				<RequireAuthAsUserParam>
					<UserIntegrationsPage reqUser={reqUser} />
				</RequireAuthAsUserParam>
			</Route>
			<Route path="/u/:userID/imports">
				<RequireAuthAsUserParam>
					<UserImportsPage reqUser={reqUser} />
				</RequireAuthAsUserParam>
			</Route>
			<Route exact path="/u/:userID/orphans">
				<RequireAuthAsUserParam>
					<UserOrphansPage reqUser={reqUser} />
				</RequireAuthAsUserParam>
			</Route>
			<Route exact path="/u/:userID/invites">
				<RequireAuthAsUserParam>
					<UserInvitesPage reqUser={reqUser} />
				</RequireAuthAsUserParam>
			</Route>
		</>
	);
}

function UserGameRoutes({ reqUser }: { reqUser: UserDocument }) {
	return (
		<Switch>
			<Route path="/u/:userID/games/:game">
				<V3UserGameRoutes reqUser={reqUser} />
			</Route>
		</Switch>
	);
}

function V3UserGameRoutes({ reqUser }: { reqUser: UserDocument }) {
	const { game: gameParam } = useParams<{ game: string }>();

	if (!IsSupportedGame(gameParam)) {
		return (
			<ErrorPage customMessage={`The game ${gameParam} is not supported.`} statusCode={400} />
		);
	}

	const game = gameParam;

	return (
		<UserGameContextProvider>
			<TargetsContextProvider>
				<Inner game={game} reqUser={reqUser} />
			</TargetsContextProvider>
		</UserGameContextProvider>
	);
}

function Inner({ reqUser, game }: { game: V3Game; reqUser: UserDocument }) {
	const { user } = useContext(UserContext);

	const { data, error } = useQuery<UserGameStatsReturn, APIFetchV1Return<UserGameStats>>(
		[reqUser.id, game],
		async () => {
			const res = await APIFetchV1<UserGameStatsReturn>(`/users/${reqUser.id}/games/${game}`);

			if (!res.success) {
				console.error(res);
				throw res;
			}

			return res.body;
		},
		{ retry: 0 },
	);

	if (error?.statusCode === 404) {
		return <ErrorPage customMessage="This user has not played this game!" statusCode={404} />;
	}

	if (error) {
		return <ErrorPage statusCode={error.statusCode} />;
	}

	if (!data) {
		return <Loading />;
	}

	const stats = data;

	return (
		<>
			<LayoutHeaderContainer
				footer={
					<UserGameNav
						baseUrl={`/u/${reqUser.username}/games/${game}`}
						game={game}
						isRequestedUser={reqUser.id === user?.id}
					/>
				}
				header={`${reqUser.username}'s ${FormatGame(game)} Profile`}
			>
				<UserGameHeaderBody game={game} reqUser={reqUser} stats={stats} />
			</LayoutHeaderContainer>
			<Switch>
				<Route exact path="/u/:userID/games/:game">
					<OverviewPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/scores">
					<ScoresPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/folders">
					<FoldersMainPage game={game} reqUser={reqUser} />
				</Route>
				<Route exact path="/u/:userID/games/:game/sessions">
					<SessionsPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/sessions/:sessionID">
					<SpecificSessionPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/rivals">
					<RivalsMainPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/targets">
					<TargetsPage game={game} reqUser={reqUser} />
				</Route>
				<Route exact path="/u/:userID/games/:game/leaderboard">
					<LeaderboardsPage game={game} reqUser={reqUser} />
				</Route>
				<Route path="/u/:userID/games/:game/utils">
					<UserGameUtilsPage game={game} reqUser={reqUser} />
				</Route>
				<RequireAuthAsUserParam>
					<Route exact path="/u/:userID/games/:game/settings">
						<UserGameSettingsPage game={game} reqUser={reqUser} />
					</Route>
				</RequireAuthAsUserParam>
				<Route path="*">
					<ErrorPage statusCode={404} />
				</Route>
			</Switch>
		</>
	);
}
