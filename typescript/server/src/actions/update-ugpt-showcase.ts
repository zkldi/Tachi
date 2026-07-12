import { MakeAction } from "#lib/actions/actions";
import { GetUserGameSettingsDocument } from "#lib/db-formats/user-game-settings";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { type ShowcaseStatDetails } from "tachi-common";

export const ACTION_UpdateUserGameShowcase = MakeAction(
	"UPDATE_USER_GAME_SHOWCASE",
	async (taker, input) => {
		const { userID, game, stats } = input;

		if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorised to modify this user's showcase.");
		}

		const profileRow = await DB.selectFrom("game_profile")
			.select("game_profile.user_id")
			.where("game_profile.user_id", "=", userID)
			.where("game_profile.game", "=", game)
			.executeTakeFirst();

		if (!profileRow) {
			throw new ExpectedErr(404, "You do not have a profile for this game.");
		}

		const payload = stats as Array<ShowcaseStatDetails>;

		await DB.updateTable("game_profile")
			.set({ showcase: JSON.stringify(payload) })
			.where("game_profile.user_id", "=", userID)
			.where("game_profile.game", "=", game)
			.execute();

		const newSettings = await GetUserGameSettingsDocument(userID, game);

		if (!newSettings) {
			throw new ExpectedErr(500, "Failed to load settings after updating showcase.");
		}

		return {};
	},
);
