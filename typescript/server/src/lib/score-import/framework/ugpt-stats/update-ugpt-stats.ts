import type { KtLogger } from "#lib/log/log";

import {
	type CalculationRunStartedAt,
	newCalculationRunStartedAt,
} from "#lib/dirty-queues/calculation-run";
import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import DB from "#services/pg/db";
import { loadUserGameStats } from "#utils/class";
import { type ClassDelta, type integer, type V3Game } from "tachi-common";

import type { ClassProvider } from "../calculated-data/types";
import type { ClassProcessOptions } from "../profile-calculated-data/class-process-options";

import { CalculateProfileRatings } from "../calculated-data/profile";
import { CalculateUGPTClasses, ProcessClassDeltas } from "../profile-calculated-data/classes";

export type UpdateUsersGamePlaytypeStatsOptions = {
	runStartedAt?: CalculationRunStartedAt;
} & ClassProcessOptions;

export async function UpdateUsersGamePlaytypeStats(
	game: V3Game,
	userID: integer,
	classProvider: ClassProvider<V3Game> | null,
	log: KtLogger,
	options?: UpdateUsersGamePlaytypeStatsOptions,
): Promise<Array<ClassDelta>> {
	const runStartedAt = options?.runStartedAt ?? (await newCalculationRunStartedAt());
	log.debug(`Calculating Ratings...`);

	const ratings = await CalculateProfileRatings(game, userID);

	// Attempt to find a users game stats if one already exists. If one doesn't exist,
	// this is this players first import for this game!
	const userGameStats = await loadUserGameStats(userID, game);

	log.debug(`Calculating UGSClasses...`);

	const classes = await CalculateUGPTClasses(game, userID, ratings, classProvider, log);

	log.debug(`Finished Calculating UGSClasses`);

	log.debug(`Calculating Class Deltas...`);

	const deltas = await ProcessClassDeltas(game, classes, userGameStats, userID, log, options);

	log.debug(`Had ${deltas.length} deltas.`);

	if (userGameStats) {
		log.debug(`Updated player gamestats for ${game}`);

		const nextClasses: Record<string, string | null | undefined> = {
			...userGameStats.classes,
		};

		for (const delta of deltas) {
			nextClasses[delta.set] = delta.new;
		}

		await DB.updateTable("game_profile")
			.set({
				ratings: JSON.stringify(ratings),
				classes: JSON.stringify(nextClasses),
				last_clean_started_at: runStartedAt,
			})
			.where("user_id", "=", userID)
			.where("game", "=", game)
			.where("last_clean_started_at", "<=", runStartedAt)
			.execute();
	} else {
		const hasAnyScores = await DB.selectFrom("score")
			.select("id")
			.where("user_id", "=", userID)
			.where("game", "=", game)
			.executeTakeFirst();

		if (!hasAnyScores) {
			log.debug(
				{
					userID,
					game,
				},
				"Not creating new game stats for user with no scores.",
			);
			return deltas;
		}

		log.info(`Created new gamestats for ${game}`);
		await DB.insertInto("game_profile")
			.values({
				user_id: userID,
				game,
				ratings: JSON.stringify(ratings),
				classes: JSON.stringify(classes),
				last_clean_started_at: runStartedAt,
				...newGameProfilePreferenceColumns(game),
			})
			.execute();
	}

	return deltas;
}
