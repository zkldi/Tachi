import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import { log } from "#lib/log/log";
import { EmitWebhookEvent } from "#lib/webhooks/webhooks";
import DB from "#services/pg/db";
import {
	type Classes,
	GetGameConfig,
	type integer,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

function parseProfileJson<T>(v: unknown): T {
	if (typeof v === "string") {
		return JSON.parse(v) as T;
	}

	return v as T;
}

export async function loadUserGameStats(
	userID: integer,
	game: V3Game,
): Promise<UserGameStats | null> {
	const row = await DB.selectFrom("game_profile")
		.select(["ratings", "classes"])
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return {
		userID,
		game,
		ratings: parseProfileJson(row.ratings),
		classes: parseProfileJson(row.classes),
	};
}

/**
 * Returns the provided class if it is greater than the one in userGameStats
 * @returns The provided class if it is greater, NULL if there is nothing
 * to compare to, and FALSE if it is worse or equal.
 */
export function ReturnClassIfGreater(
	game: V3Game,
	classSet: Classes[V3Game],
	classVal: string,
	userGameStats?: UserGameStats | null,
): boolean | null {
	const gameConfig = GetGameConfig(game);

	const classInfo = gameConfig.classes[classSet];

	if (!classInfo) {
		log.warn(
			`Invalid ReturnClassIfGreater call. Attempted to index set '${classSet}' on ${game}. No such class is defined for this game.`,
		);

		return null;
	}

	if (!userGameStats) {
		return null;
	}

	const prevClass: string | null | undefined = userGameStats.classes[classSet];

	if (prevClass === null || prevClass === undefined) {
		return null;
	}

	const previousClassIndex = ClassToIndex(game, classSet, prevClass);
	const newClassIndex = ClassToIndex(game, classSet, classVal);

	if (previousClassIndex === null && newClassIndex === null) {
		return null;
	} else if (newClassIndex === null) {
		return null;
	} else if (previousClassIndex === null) {
		return true;
	}

	return newClassIndex > previousClassIndex;
}

export function ClassToIndex(game: V3Game, classSet: Classes[V3Game], classVal: string) {
	const gameConfig = GetGameConfig(game);

	const classInfo = gameConfig.classes[classSet];

	if (!classInfo) {
		log.warn(
			`Invalid ClassToIndex call. Attempted to index set '${classSet}' on ${game}. No such class is defined for this game. Returning null.`,
		);
		return null;
	}

	const v = classInfo.values.map((e) => e.id).indexOf(classVal);

	if (v === -1) {
		log.warn(
			`Attempted to index a class that doesn't exist: ${classVal} on ${classSet} (${game}). Returning null.`,
		);
		return null;
	}

	return v;
}

/**
 * Updates a user's class value if it is greater than the one in their
 * MONGO_UserGameStats.
 * @returns False if nothing was updated.
 * Null if it was updated because there was nothing in MONGO_UserGameStats to
 * compare to.
 * True if it was updated because it was better than MONGO_UserGameStats.
 */
export async function UpdateClassIfGreater(
	userID: integer,
	game: V3Game,
	classSet: Classes[V3Game],
	classVal: string,
) {
	const userGameStats = await loadUserGameStats(userID, game);
	const isGreater = ReturnClassIfGreater(game, classSet, classVal, userGameStats);

	if (isGreater === false) {
		return false;
	}

	if (userGameStats) {
		const nextClasses = {
			...userGameStats.classes,
			[classSet]: classVal,
		};

		await DB.updateTable("game_profile")
			.set({ classes: JSON.stringify(nextClasses) })
			.where("user_id", "=", userID)
			.where("game", "=", game)
			.execute();
	} else {
		await DB.insertInto("game_profile")
			.values({
				classes: JSON.stringify({ [classSet]: classVal }),
				game,
				ratings: JSON.stringify({}),
				user_id: userID,
				...newGameProfilePreferenceColumns(game),
			})
			.execute();

		log.info(`Created new player gamestats for ${userID} (${game})`);
	}

	const prevForAchievement =
		isGreater === null
			? ""
			: String(userGameStats?.classes[classSet as keyof typeof userGameStats.classes] ?? "");

	await DB.insertInto("class_achievement")
		.values({
			class_prev_value: prevForAchievement,
			class_set: classSet,
			class_value: classVal,
			game,
			timestamp: new Date().toISOString(),
			user_id: userID,
		})
		.execute();

	if (isGreater === null) {
		void EmitWebhookEvent({
			type: "class-update/v1",
			content: { userID, new: classVal, old: null, set: classSet, game },
		});

		return null;
	}

	void EmitWebhookEvent({
		type: "class-update/v1",
		content: {
			userID,
			new: classVal,
			old: userGameStats!.classes[classSet]!,
			set: classSet,
			game,
		},
	});

	return true;
}
