import Loading from "#components/util/Loading";
import fetchUserGameData, {
	type UserGameData as UserGameData,
} from "#components/util/query/fetchUserGameData";
import { type JustChildren, type SetState } from "#types/react";
import { IsSupportedGame } from "#util/asserts";
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { UserContext } from "./UserContext";

/**
 * Contextually important data meant to be carried around about user
 * profiles.
 *
 * If we're viewing a user's profile (a profile is a user+game), then viewingData will
 * contain information about the person we're viewing.
 *
 * If we're viewing a global game page, then viewingData will
 * be null.
 *
 * LoggedInData will be null if a user is not logged in, and non-null
 * if they are.
 */
export const UserGameContext = createContext<{
	loggedInData: UserGameData | null;
	setLoggedInData: SetState<UserGameData | null>;
	setViewingData: SetState<UserGameData | null>;
	viewingData: UserGameData | null;
}>({
	loggedInData: null,
	setLoggedInData: () => void 0,

	viewingData: null,
	setViewingData: () => void 0,
});

UserGameContext.displayName = "UserGameContext";

export function UserGameContextProvider({ children }: JustChildren) {
	const { game, userID: viewingUserID } = useParams<{
		game: string;
		userID: string | undefined;
	}>();

	if (!IsSupportedGame(game)) {
		throw new Error(`Invalid game of ${game}. Did you mess up?`);
	}

	const { user } = useContext(UserContext);

	const [loggedLoading, setLoggedLoading] = useState(true);
	const [viewingLoading, setViewingLoading] = useState(true);

	const [viewingData, setViewingData] = useState<UserGameData | null>(null);
	const [loggedInData, setLoggedInData] = useState<UserGameData | null>(null);

	useEffect(() => {
		(async () => {
			setLoggedLoading(true);
			setViewingLoading(true);

			if (viewingUserID === undefined) {
				setViewingData(null);
			} else {
				const viewingData = await fetchUserGameData(viewingUserID, game);

				setViewingData(viewingData);

				if (
					user &&
					// stupid hack because viewingUserID might be a
					// username; also it's a string. dumb.
					(user.id === Number(viewingUserID) ||
						user.usernameLowercase === viewingUserID.toLowerCase())
				) {
					// optimsation: the viewing user and logged
					// in user are the same user.
					// make one fetch instead of two
					setLoggedInData(viewingData);
					setLoggedLoading(false);
					setViewingLoading(false);

					return;
				}
			}

			setViewingLoading(false);

			if (!user) {
				setLoggedInData(null);
			} else {
				const loggedData = await fetchUserGameData(user.id, game);

				setLoggedInData(loggedData);
			}

			setLoggedLoading(false);
		})();
	}, [user, game, viewingUserID]);

	if (viewingLoading || loggedLoading) {
		return <Loading />;
	}

	return (
		<UserGameContext.Provider
			value={{
				loggedInData,
				setLoggedInData,
				viewingData,
				setViewingData,
			}}
		>
			{children}
		</UserGameContext.Provider>
	);
}
