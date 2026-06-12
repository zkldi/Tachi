import { MakeAction } from "#lib/actions/actions";
import {
	GetUserGameSettingsDocument,
	SELECT_GAME_PROFILE_SETTINGS,
} from "#lib/db-formats/user-game-settings";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { type UserGameSettingsDocument } from "tachi-common";
import { type GameProfileUpdate } from "tachi-db";

export const ACTION_PatchUserGameSettings = MakeAction(
	"PATCH_USER_GAME_SETTINGS",
	async (taker, input) => {
		const { userID, game, preferences } = input;
		const body = preferences as Partial<UserGameSettingsDocument["preferences"]>;

		if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorised to modify this user's settings.");
		}

		if (typeof body.defaultTable === "string") {
			const table = await DB.selectFrom("table")
				.select("id")
				.where("game", "=", game)
				.where("legacy_id", "=", body.defaultTable)
				.executeTakeFirst();

			if (!table) {
				throw new ExpectedErr(
					400,
					`The table (${body.defaultTable}) does not exist (and therefore cannot be set as a default).`,
				);
			}
		}

		const hasGameSpecificKeys =
			body.gameSpecific !== undefined &&
			body.gameSpecific !== null &&
			typeof body.gameSpecific === "object" &&
			Object.keys(body.gameSpecific as object).length > 0;

		const hasUpdates =
			body.preferredScoreAlg !== undefined ||
			body.preferredSessionAlg !== undefined ||
			body.preferredProfileAlg !== undefined ||
			body.preferredDefaultEnum !== undefined ||
			body.defaultTable !== undefined ||
			body.preferredRanking !== undefined ||
			hasGameSpecificKeys;

		if (!hasUpdates) {
			const settings = await GetUserGameSettingsDocument(userID, game);
			if (!settings) {
				throw new ExpectedErr(404, "You do not have an account for this game.");
			}
			return { settings };
		}

		const row = await DB.selectFrom("game_profile")
			.select(SELECT_GAME_PROFILE_SETTINGS)
			.where("game_profile.user_id", "=", userID)
			.where("game_profile.game", "=", game)
			.executeTakeFirst();

		if (!row) {
			throw new ExpectedErr(404, "You do not have an account for this game.");
		}

		const set: GameProfileUpdate = {};

		if (body.preferredScoreAlg !== undefined) {
			set.pf_preferred_score_alg = body.preferredScoreAlg;
		}
		if (body.preferredSessionAlg !== undefined) {
			set.pf_preferred_session_alg = body.preferredSessionAlg;
		}
		if (body.preferredProfileAlg !== undefined) {
			set.pf_preferred_profile_alg = body.preferredProfileAlg;
		}
		if (body.preferredDefaultEnum !== undefined) {
			set.pf_preferred_default_enum = body.preferredDefaultEnum;
		}
		if (body.defaultTable !== undefined) {
			set.pf_default_table = body.defaultTable;
		}
		if (body.preferredRanking !== undefined) {
			set.pf_preferred_ranking = body.preferredRanking;
		}

		if (hasGameSpecificKeys) {
			const nextData = {
				...(row.data as Record<string, unknown>),
				...(body.gameSpecific as Record<string, unknown>),
			};
			set.data = JSON.stringify(nextData);
		}

		if (Object.keys(set).length === 0) {
			const settings = await GetUserGameSettingsDocument(userID, game);
			if (!settings) {
				throw new ExpectedErr(404, "You do not have an account for this game.");
			}
			return { settings };
		}

		await DB.updateTable("game_profile")
			.set(set)
			.where("game_profile.user_id", "=", userID)
			.where("game_profile.game", "=", game)
			.execute();

		const settings = await GetUserGameSettingsDocument(userID, game);
		if (!settings) {
			throw new ExpectedErr(500, "Settings were updated but could not be reloaded.");
		}
		return { settings };
	},
);
