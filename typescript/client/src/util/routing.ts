import { EscapeStringRegexp } from "./misc";

function pathnameOnlyForRouteMatch(str: string): string {
	try {
		return new URL(str).pathname;
	} catch {
		return str.split(/[?#]/u)[0];
	}
}

export function DoesMatchRoute(str: string, route: string, ends = true) {
	const pathStr = pathnameOnlyForRouteMatch(str);
	const comps = EscapeStringRegexp(route).split("/");

	let regexStr = "";
	for (const comp of comps) {
		if (comp.startsWith(":")) {
			regexStr += "[^/]*/";
		} else {
			regexStr += `${comp}/`;
		}
	}

	regexStr += "?";

	if (ends) {
		regexStr += "$";
	}

	const regex = new RegExp(regexStr, "u");
	return !!pathStr.match(regex);
}
