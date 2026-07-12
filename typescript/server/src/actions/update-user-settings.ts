import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_UpdateUserSettings = MakeAction(
	"UPDATE_USER_SETTINGS",
	async (
		taker,
		{ invisible, developerMode, contentiousContent, advancedMode, deletableScores },
	) => {
		const updates: {
			pf_advanced_mode?: boolean;
			pf_contentious_content?: boolean;
			pf_deletable_scores?: boolean;
			pf_developer_mode?: boolean;
			pf_invisible?: boolean;
		} = {};

		if (invisible !== undefined) {
			updates.pf_invisible = invisible;
		}
		if (developerMode !== undefined) {
			updates.pf_developer_mode = developerMode;
		}
		if (contentiousContent !== undefined) {
			updates.pf_contentious_content = contentiousContent;
		}
		if (advancedMode !== undefined) {
			updates.pf_advanced_mode = advancedMode;
		}
		if (deletableScores !== undefined) {
			updates.pf_deletable_scores = deletableScores;
		}

		if (Object.keys(updates).length === 0) {
			throw new ExpectedErr(400, "Nothing was provided to change!");
		}

		await DB.updateTable("account_settings")
			.set(updates)
			.where("user_id", "=", taker.acct.id)
			.execute();

		return {};
	},
);
