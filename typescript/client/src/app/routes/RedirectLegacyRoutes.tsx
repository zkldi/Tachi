import { Redirect } from "react-router-dom";

/**
 * The site used to use "/dashboard" before all significant routes.
 * I got tired of seeing this in my browser and thought it was ugly.
 * as such, this redirects any legacy urls to the new stuff.
 */
export default function RedirectLegacyRoutes() {
	const newUrl = window.location.pathname.replace(/^\/dashboard\/?/u, "/");

	return <Redirect to={newUrl} />;
}

export function RedirectLegacyUserRoutes() {
	const newUrl = window.location.pathname.replace(/^\/users/u, "/u");

	return <Redirect to={newUrl} />;
}
