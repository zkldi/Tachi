import { GetUserGameSettingsDocument } from "#lib/db-formats/user-game-settings";
import { log } from "#lib/log/log";
import { type integer, type ShowcaseStatDetails, type V3Game } from "tachi-common";

import { EvaluateShowcaseStat } from "./evaluator";
import { GetRelatedStatDocuments } from "./get-related";

/**
 * Evaluate a users set Stats Showcase.
 * @param projectUserStats - Optionally, provide another users ID here. Their stats showcase will be
 * used instead.
 */
export async function EvaluateUsersStatsShowcase(
	userID: integer,
	game: V3Game,
	projectUserStats?: integer,
) {
	const getSettingsID = projectUserStats ?? userID;
	const settings = await GetUserGameSettingsDocument(getSettingsID, game);

	if (!settings) {
		log.error(
			`User ${getSettingsID} has no game profile row, yet a call to EvaluateUsersStatsShowcase was made.`,
		);

		throw new Error(
			`User ${getSettingsID} has no game profile row, yet a call to EvaluateUsersStatsShowcase was made.`,
		);
	}

	const results = await Promise.all(
		settings.preferences.stats.map((details) => EvaluateStats(game, details, userID)),
	);

	return results;
}

async function EvaluateStats(game: V3Game, details: ShowcaseStatDetails, userID: integer) {
	const [result, related] = await Promise.all([
		EvaluateShowcaseStat(game, details, userID),
		GetRelatedStatDocuments(details, game),
	]);

	return { stat: details, result, related };
}
