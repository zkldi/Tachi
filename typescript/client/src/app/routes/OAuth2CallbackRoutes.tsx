import LoginPage from "#app/pages/LoginPage";
import OAuth2CallbackPage from "#app/pages/OAuth2CallbackPage";
import SplashImage from "#components/layout/misc/SplashImage";
import { UserContext } from "#context/UserContext";
import React, { useContext } from "react";
import { Route, Switch } from "react-router-dom";

export default function OAuth2CallbackRoutes() {
	const { user } = useContext(UserContext);

	if (!user) {
		return <LoginPage />;
	}

	return (
		<div
			style={{
				position: "absolute",
				zIndex: 1000,
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexDirection: "column",
				backgroundColor: "#131313",
				textAlign: "center",
				fontSize: "2rem",
			}}
		>
			<div className="mb-4">
				<SplashImage />
			</div>

			<Switch>
				<Route exact path="/oauth2-callback/min">
					<OAuth2CallbackPage
						counterWeight={`/users/${user.id}/integrations/kai/min/oauth2callback`}
						serviceName="MIN"
					/>
				</Route>
				<Route exact path="/oauth2-callback/eag">
					<OAuth2CallbackPage
						counterWeight={`/users/${user.id}/integrations/kai/eag/oauth2callback`}
						serviceName="EAG"
					/>
				</Route>
				<Route exact path="/oauth2-callback/flo">
					<OAuth2CallbackPage
						counterWeight={`/users/${user.id}/integrations/kai/flo/oauth2callback`}
						serviceName="FLO"
					/>
				</Route>
			</Switch>
		</div>
	);
}
