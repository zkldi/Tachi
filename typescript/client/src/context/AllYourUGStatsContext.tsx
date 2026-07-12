import { type JustChildren, type SetState } from "#types/react";
import { createContext, useState } from "react";
import { type UserGameStats } from "tachi-common";

/**
 * Contains all of the currently logged-in users GameStats.
 *
 * Used to display things like the "your games" tab, and assorted
 * dashboard info.
 */
export const AllYourUGStatsContext = createContext<{
	setUGS: SetState<UserGameStats[] | null>;
	ugs: UserGameStats[] | null;
}>({ ugs: null, setUGS: () => void 0 });
AllYourUGStatsContext.displayName = "AllYourUGStatsContext";

export function AllYourUGStatsContextProvider({ children }: JustChildren) {
	const [ugs, setUGS] = useState<UserGameStats[] | null>(null);

	return (
		<AllYourUGStatsContext.Provider value={{ ugs, setUGS }}>
			{children}
		</AllYourUGStatsContext.Provider>
	);
}
