import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { CreateBatchManualClassProvider } from "#lib/score-import/import-types/common/batch-manual/class-handler";
import { AllEnabledGames } from "#lib/setup/config";
import DB from "#services/pg/db";
import { IsRecord } from "#utils/misc";
import { GetUserWithID } from "#utils/user";
import {
	type Classes,
	GameToGameGroup,
	GetGameConfig,
	GetProvidedClassSetsForGame,
	type integer,
	type V3Game,
} from "tachi-common";

function ValidateProvidedClasses(
	game: V3Game,
	classes: Record<string, string>,
	log: KtLogger,
): void {
	if (!IsRecord(classes)) {
		throw new ScoreImportFatalError(400, `Invalid classes object.`);
	}

	const providedClassSets = GetProvidedClassSetsForGame(game);

	if (providedClassSets.length === 0) {
		throw new ScoreImportFatalError(400, `${game} does not support manual class imports.`);
	}

	const keys = Object.keys(classes);

	if (keys.length === 0) {
		throw new ScoreImportFatalError(400, `At least one class must be provided.`);
	}

	for (const classSet of keys) {
		if (!providedClassSets.includes(classSet)) {
			const gameConfig = GetGameConfig(game);

			if (classSet in gameConfig.classes) {
				throw new ScoreImportFatalError(
					400,
					`Class set "${classSet}" is derived and cannot be set manually.`,
				);
			}

			throw new ScoreImportFatalError(
				400,
				`Invalid class set "${classSet}" for ${game}. Expected any of ${providedClassSets.join(", ")}.`,
			);
		}
	}

	CreateBatchManualClassProvider(
		game,
		classes as Partial<Record<Classes[V3Game], string | null>>,
	)(game, 0, {}, log);
}

async function AssertUserHasGameProfile(userID: integer, game: V3Game): Promise<void> {
	const profile = await DB.selectFrom("game_profile")
		.select("game_profile.user_id")
		.where("game_profile.user_id", "=", userID)
		.where("game_profile.game", "=", game)
		.executeTakeFirst();

	if (profile) {
		return;
	}

	const user = await GetUserWithID(userID);
	const username = user?.username ?? String(userID);

	throw new ScoreImportFatalError(404, `The user ${username} has not played ${game}`);
}

export default async function ParseImportClass(
	userID: integer,
	game: V3Game,
	classes: Record<string, string>,
	log: KtLogger,
): Promise<ParserFunctionReturns<never, Record<string, never>, V3Game>> {
	if (!AllEnabledGames().includes(game)) {
		throw new ScoreImportFatalError(
			400,
			`Invalid game ${game}. Expected any of ${AllEnabledGames().join(", ")}.`,
		);
	}

	await AssertUserHasGameProfile(userID, game);

	ValidateProvidedClasses(game, classes, log);

	const classProvider = CreateBatchManualClassProvider(
		game,
		classes as Partial<Record<Classes[V3Game], string | null>>,
	);

	return {
		service: "Manual Class Import",
		context: {},
		gameGroup: GameToGameGroup(game),
		iterable: [],
		classProvider,
	};
}
