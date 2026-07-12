import { type JustChildren, type SetState } from "#types/react";
import { NO_OP } from "#util/misc";
import React, { createContext, useState } from "react";

export const SubheaderContext = createContext({
	title: "",
	setTitle: NO_OP as SetState<string>,
	breadcrumbs: [] as string[],
	setBreadcrumbs: NO_OP as SetState<string[]>,
});

export function SubheaderContextProvider({ children }: JustChildren) {
	const [title, setTitle] = useState("");
	const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
	return (
		<SubheaderContext.Provider value={{ title, setTitle, breadcrumbs, setBreadcrumbs }}>
			{children}
		</SubheaderContext.Provider>
	);
}
