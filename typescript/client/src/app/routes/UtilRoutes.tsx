import ImportAnalysers from "#app/pages/dashboard/utils/ImportAnalysers";
import { Route, Switch } from "react-router-dom";

export default function UtilRoutes() {
	return (
		<Switch>
			<Route path="/utils/imports">
				<ImportAnalysers />
			</Route>
		</Switch>
	);
}
