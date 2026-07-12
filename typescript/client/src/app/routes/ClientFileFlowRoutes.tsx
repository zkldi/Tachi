import ClientFileFlowPage from "#app/pages/ClientFileFlowPage";
import ErrorPage from "#app/pages/ErrorPage";
import CenterLayoutPage from "#components/layout/CenterLayoutPage";
import { UserContext } from "#context/UserContext";
import { useContext } from "react";
import { Route, Switch } from "react-router-dom";

export default function ClientFileFlowRoutes() {
	const { user } = useContext(UserContext);

	if (!user) {
		return (
			<ErrorPage
				customMessage="You have to be logged in to access these pages."
				statusCode={401}
			/>
		);
	}

	return (
		<Switch>
			<Route exact path="/client-file-flow/:clientID">
				<CenterLayoutPage>
					<ClientFileFlowPage />
				</CenterLayoutPage>
			</Route>

			<Route path="*">
				<ErrorPage statusCode={404} />
			</Route>
		</Switch>
	);
}
