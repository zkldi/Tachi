import CreditsPage from "#app/pages/dashboard/misc/CreditsPage";
import MyProposalsPage from "#app/pages/dashboard/proposals/MyProposalsPage";
import ProposalsPage from "#app/pages/dashboard/proposals/ProposalsPage";
import SearchPage from "#app/pages/dashboard/search/SearchPage";
import NotificationsPage from "#app/pages/dashboard/users/NotificationsPage";
import ErrorPage from "#app/pages/ErrorPage";
import PrivacyPolicyPage from "#app/pages/PrivacyPolicyPage";
import { Layout } from "#components/layout/Layout";
import EmailVerify from "#components/layout/misc/EmailVerify";
import DashboardErrorBoundary from "#components/util/DashboardErrorBoundary";
import { BackgroundContext } from "#context/BackgroundContext";
import { BannedContext } from "#context/BannedContext";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import { APIFetchV1, ToAPIURL } from "#util/api";
import { useContext, useEffect, useState } from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import { DashboardPage } from "../pages/dashboard/DashboardPage";
import QuestEditor from "../pages/dashboard/utils/QuestEditor";
import AdminRoutes from "./AdminRoutes";
import GameRoutes from "./GameRoutes";
import ImportRoutes from "./ImportRoutes";
import { RedirectLegacyUserRoutes } from "./RedirectLegacyRoutes";
import UserRoutes from "./UserRoutes";
import UtilRoutes from "./UtilRoutes";

function QuestEditorRoute() {
	if (!TachiConfig.QUEST_PROPOSALS_ENABLED) {
		return <Redirect to="/" />;
	}

	return <QuestEditor />;
}

export default function DashboardRoutes() {
	const { user } = useContext(UserContext);
	const { banned } = useContext(BannedContext);
	const { setBackground } = useContext(BackgroundContext);

	const [hasVerifiedEmail, setHasVerifiedEmail] = useState<boolean | null>(null);

	useEffect(() => {
		if (!user) {
			return setHasVerifiedEmail(null);
		}

		(async () => {
			const hasVerified = await APIFetchV1<boolean>(`/users/${user.id}/is-email-verified`);

			if (hasVerified.success) {
				setHasVerifiedEmail(hasVerified.body);
			}
		})();
	}, [user]);

	useEffect(() => {
		if (user) {
			setBackground(ToAPIURL(`/users/${user.id}/banner`));
		} else {
			setBackground(null);
		}

		return () => {
			setBackground(null);
		};
	}, [user]);

	if (hasVerifiedEmail === false) {
		return (
			<Layout>
				<EmailVerify setHasVerifiedEmail={setHasVerifiedEmail} />
			</Layout>
		);
	}

	if (banned) {
		return <ErrorPage customMessage="You are banned." statusCode={403} />;
	}

	return (
		<Layout>
			<DashboardErrorBoundary>
				<Switch>
					{/* this is the easiest (read: least sucky) way of handling */}
					{/* these routes */}
					<Route exact path={["/", "/profiles", "/calendar", "/global-activity"]}>
						<DashboardPage />
					</Route>

					<Route path="/search">
						<SearchPage />
					</Route>

					<Route exact path="/privacy">
						<PrivacyPolicyPage />
					</Route>

					<Route exact path="/credits">
						<CreditsPage />
					</Route>

					{/* <Route exact path="/support">
						<SupportMePage />
					</Route> */}

					{/* this used to be called /dashboard/users/username, now it's called /u/username */}
					<Route path="/users">
						<RedirectLegacyUserRoutes />
					</Route>

					<Route exact path="/u">
						<Redirect to="/" />
					</Route>

					<Route exact path="/g">
						<Redirect to="/" />
					</Route>

					<Route path="/u/:userID">
						<UserRoutes />
					</Route>

					<Route exact path="/games">
						<Redirect to="/" />
					</Route>

					<Route path="/games/:game">
						<GameRoutes />
					</Route>

					<Route path="/import">
						<ImportRoutes />
					</Route>

					<Route exact path="/utils/seeds">
						<Redirect to="/" />
					</Route>

					<Route exact path="/utils/quests">
						<Redirect to="/quests" />
					</Route>

					<Route exact path="/quests">
						<QuestEditorRoute />
					</Route>

					<Route path="/utils">
						<UtilRoutes />
					</Route>

					<Route exact path="/proposals">
						<ProposalsPage />
					</Route>

					<Route exact path="/proposals/mine">
						<MyProposalsPage />
					</Route>

					<Route path="/notifications">
						<NotificationsPage />
					</Route>

					<Route path="/admin">
						<AdminRoutes />
					</Route>

					<Route path="*">
						<ErrorPage statusCode={404} />
					</Route>
				</Switch>
			</DashboardErrorBoundary>
		</Layout>
	);
}
