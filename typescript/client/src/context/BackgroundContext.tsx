import { type JustChildren, type SetState } from "#types/react";
import { NO_OP } from "#util/misc";
import React, { createContext, useState } from "react";

export const BackgroundContext = createContext<{
	background: string | null;
	setBackground: SetState<string | null>;
}>({ background: null, setBackground: NO_OP });

BackgroundContext.displayName = "BackgroundContext";

export function BackgroundContextProvider({ children }: JustChildren) {
	const [background, setBackground] = useState<string | null>(null);

	return (
		<BackgroundContext.Provider value={{ background, setBackground }}>
			{children}
		</BackgroundContext.Provider>
	);
}
