import { type JustChildren, type SetState } from "#types/react";
import React, { createContext, useState } from "react";

/**
 * Contains whether the current user is banned or not.
 */
export const BannedContext = createContext<{
	banned: boolean;
	setBanned: SetState<boolean>;
}>({ banned: false, setBanned: () => void 0 });
BannedContext.displayName = "BannedContext";

export function BannedContextProvider({ children }: JustChildren) {
	const [banned, setBanned] = useState<boolean>(false);

	return (
		<BannedContext.Provider value={{ banned, setBanned }}>{children}</BannedContext.Provider>
	);
}
