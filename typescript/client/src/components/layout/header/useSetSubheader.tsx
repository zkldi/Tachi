import useSplashText from "#components/util/useSplashText";
import { SubheaderContext } from "#context/SubheaderContext";
import { UpdateSubheader } from "#util/subheader";
import { useContext, useEffect } from "react";

export default function useSetSubheader(
	content: string | string[],

	deps: unknown[] = [],
	overrideTitle?: string,
) {
	const { setTitle, setBreadcrumbs } = useContext(SubheaderContext);

	const splash = useSplashText();

	useEffect(() => {
		UpdateSubheader(
			Array.isArray(content) ? content : [content],
			setTitle,
			setBreadcrumbs,
			splash,
			overrideTitle,
		);
	}, deps);
}
