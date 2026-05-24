import type { KtLogger } from "#lib/log/log";

import { EmitWebhookEvent } from "#lib/webhooks/webhooks";
import DB from "#services/pg/db";
import { ReturnClassIfGreater } from "#utils/class";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import deepmerge from "deepmerge";
import {
	type AnyClasses,
	type ClassDelta,
	type Classes,
	type ExtractedClasses,
	GetGameConfig,
	type integer,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

import type { ClassProvider } from "../calculated-data/types";
import type { ClassProcessOptions } from "./class-process-options";

import { CalculateDerivedClasses } from "../calculated-data/profile-classes";

/**
 * Calculates a User's Game Stats Classes. This function is rather complex, because the reality is rather complex.
 *
 * A class is simply a hard bounded division dependent on a user. Such as a Dan or a skill level dependent on a statistic.
 * Not all services expose this information in the same way, so this function takes an async resolve function,
 * which is allowed to return its own classes. These will be merged with the classes that *we* can calculate.
 *
 * As an example, we are always able to calculate things like Gitadora's colours. We know the user's skill statistic,
 * and a colour is just between X-Y skill. However, we cannot always calculate something like IIDX's dans. Infact,
 * there's no calculation involved. We need to instead request this information from a service. For things like FLO
 * they expose this on a dedicated endpoint.
 * The custom function allows us to request that data from a custom endpoint, and merge it with things we can always
 * calculate.
 *
 * @param ratings - A users ratings. This is calculated in rating.ts, and passed via update-ugs.ts.
 * We request this because we need it for things like gitadora's skill divisions - We don't need to calculate our skill
 * statistic twice if we just request it be passed to us!
 * @param ClassProvider - The Custom Resolve Function that certain import types may pass to us as a means
 * for providing information about a class. This returns the same thing as this function, and it is merged with the
 * defaults.
 */
export async function CalculateUGPTClasses(
	game: V3Game,
	userID: integer,
	ratings: Record<string, number | null>,
	ClassProvider: ClassProvider<V3Game> | null,
	log: KtLogger,
): Promise<ExtractedClasses[V3Game]> {
	// Derive all classes first.
	let classes = CalculateDerivedClasses(game, ratings);

	// If this import method is providing us classes, merge those with the
	// other classes we have.
	if (ClassProvider) {
		log.debug(`Calling custom class handler.`);
		const customClasses = (await ClassProvider(game, userID, ratings, log)) ?? {};

		classes = deepmerge(customClasses, classes);
	}

	return classes;
}

/**
 * Calculates the class "deltas" for this users classes.
 * This is for calculating scenarios where a users class has improved (i.e. they have gone from 9th dan to 10th dan).
 *
 * If a class is provided, we don't want to potentially downgrade users. I.e.
 * if a user clears 7th dan while they're 10th dan, we don't want to downgrade them.
 *
 * For derived classes however, downgrading is fine.
 *
 * Knowing this information allows us to attach it onto the import, and also emit things on webhooks.
 * This function emits webhook events and inserts classachieved documents into the DB!
 */
export async function ProcessClassDeltas(
	game: V3Game,
	classes: AnyClasses,
	userGameStats: UserGameStats | null,
	userID: integer,
	log: KtLogger,
	options?: ClassProcessOptions,
): Promise<Array<ClassDelta>> {
	const deltas: Array<ClassDelta> = [];

	const achievementOps = [];

	const gameConfig = GetGameConfig(game);
	const classAchievementSource = options?.classAchievementSource ?? "import";

	for (const s of Object.keys(classes)) {
		const classSet = s as Classes[V3Game];
		const classVal = classes[classSet];

		if (classVal === undefined || classVal === null) {
			log.debug(`Skipped deltaing-class ${classSet}.`);
			continue;
		}

		const classConfig = gameConfig.classes[classSet]!;

		try {
			const isGreater = ReturnClassIfGreater(game, classSet, classVal, userGameStats);

			// if this was worse, and this class is PROVIDED (i.e. it's a dan)
			// then don't do anything unless manual import explicitly allows downgrades
			if (
				isGreater === false &&
				classConfig.type === "PROVIDED" &&
				!options?.allowProvidedDowngrades
			) {
				continue;
			} else {
				// otherwise, provide this as an update.
				// This *may* be negative in the case where the user downgraded a
				// downgradable class (i.e. deleted scores, chart re-rates).
				let delta: ClassDelta;

				if (isGreater === null) {
					delta = {
						game,
						set: classSet,
						old: null,
						new: classVal,
					};
				} else if (isGreater === true) {
					delta = {
						game,
						set: classSet,
						old: userGameStats!.classes[classSet]!,
						new: classVal,
					};
				} else {
					delta = {
						game,
						set: classSet,
						old: userGameStats!.classes[classSet]!,
						new: classVal,
					};
				}

				const shouldRecordAchievement =
					isGreater !== false || classAchievementSource === "manual";

				if (shouldRecordAchievement) {
					void EmitWebhookEvent({
						type: "class-update/v1",
						content: {
							userID,
							game,
							set: delta.set,
							old: delta.old,
							new: delta.new,
							achievementSource: classAchievementSource,
						},
					});

					achievementOps.push({
						userID,
						classSet: delta.set,
						classOldValue: delta.old,
						classValue: delta.new,
						game,
						timeAchieved: Date.now(),
						source: classAchievementSource,
					});
				}

				if (delta.old !== delta.new) {
					deltas.push(delta);
				}
			}
		} catch (err) {
			log.error(err);
		}
	}

	if (achievementOps.length > 0) {
		await DB.insertInto("class_achievement")
			.values(
				achievementOps.map((op) => ({
					class_prev_value: op.classOldValue ?? "",
					class_set: op.classSet,
					class_value: op.classValue,
					game,
					source: op.source,
					timestamp: UnixMillisecondsToISO8601(op.timeAchieved),
					user_id: op.userID,
				})),
			)
			.execute();
	}

	return deltas;
}
