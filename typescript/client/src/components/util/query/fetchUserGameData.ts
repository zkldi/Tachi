import { type UserGameStatsReturn } from "#types/api-returns";
import { APIFetchV1 } from "#util/api";
import {
	FormatGame,
	type UserDocument,
	type UserGameSettingsDocument,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

/**
 * Assorted contexts meant to be kept around when in the User Game state.
 *
 * It's worth keeping this around for both the currently-viewed user and the currently-logged-in user.
 */
export interface UserGameData {
	settings: UserGameSettingsDocument | null;
	stats: UserGameStats;
	game: V3Game;
	user: UserDocument;
}

/**
 * Given a userID, fetch important information about their ability
 * on this game.
 */
export default async function fetchUserGameData(
	userID: number | string,
	game: V3Game,
): Promise<UserGameData | null> {
	const statsRes = await APIFetchV1<UserGameStatsReturn>(`/users/${userID}/games/${game}`);

	// user doesn't exist or something?
	if (statsRes.statusCode === 404) {
		return null;
	}

	if (!statsRes.success) {
		throw new Error(
			`Failed to fetch data for ${userID} (${FormatGame(game)}): ${statsRes.description}`,
		);
	}

	const settingsRes = await APIFetchV1<UserGameSettingsDocument | null>(
		`/users/${userID}/games/${game}/settings`,
	);

	if (!settingsRes.success) {
		throw new Error(
			`Failed to fetch settings for ${userID} (${FormatGame(game)}): ${
				settingsRes.description
			}`,
		);
	}

	const userRes = await APIFetchV1<UserDocument>(`/users/${userID}`);

	if (!userRes.success) {
		throw new Error(`Failed to fetch user info for ${userID}: ${userRes.description}`);
	}

	return {
		game,
		settings: settingsRes.body,
		stats: statsRes.body.gameStats,
		user: userRes.body,
	};
}
