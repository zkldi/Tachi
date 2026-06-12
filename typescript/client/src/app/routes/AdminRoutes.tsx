import AdminActionsPage from "#app/pages/admin/AdminActionsPage";
import AdminCronJobsPage from "#app/pages/admin/AdminCronJobsPage";
import AdminDestructivePage from "#app/pages/admin/AdminDestructivePage";
import AdminJobQueuePage from "#app/pages/admin/AdminJobQueuePage";
import AdminOperationsPage from "#app/pages/admin/AdminOperationsPage";
import ErrorPage from "#app/pages/ErrorPage";
import { AdminPanelLayout } from "#components/admin/AdminPanelLayout";
import { UserContext } from "#context/UserContext";
import { useContext } from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import { UserAuthLevels } from "tachi-common";

export default function AdminRoutes() {
	const { user } = useContext(UserContext);

	if (!user) {
		return <Redirect to="/login" />;
	}

	if (user.authLevel !== UserAuthLevels.ADMIN) {
		return <ErrorPage statusCode={403} />;
	}

	return (
		<Switch>
			<Route exact path="/admin">
				<Redirect to="/admin/job-queue" />
			</Route>
			<Route path="/admin">
				<AdminPanelLayout>
					<Switch>
						<Route exact path="/admin/job-queue">
							<AdminJobQueuePage />
						</Route>
						<Route exact path="/admin/cron-jobs">
							<AdminCronJobsPage />
						</Route>
						<Route exact path="/admin/actions">
							<AdminActionsPage />
						</Route>
						<Route exact path="/admin/operations">
							<AdminOperationsPage />
						</Route>
						<Route exact path="/admin/destructive">
							<AdminDestructivePage />
						</Route>
						<Route>
							<Redirect to="/admin/job-queue" />
						</Route>
					</Switch>
				</AdminPanelLayout>
			</Route>
		</Switch>
	);
}
