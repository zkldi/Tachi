import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";

export function UpdateSubheader(
	breadcrumbs: string[],
	setTitle: SetState<string>,
	setBreadcrumbs: SetState<string[]>,
	splash: string,
	customTitle?: string,
) {
	const title = customTitle ?? breadcrumbs[breadcrumbs.length - 1] ?? "Somewhere...";

	document.title = `${title} | ${TachiConfig.NAME}`;
	setTitle(title);
	setBreadcrumbs(breadcrumbs.length === 1 ? [splash] : breadcrumbs);
}
