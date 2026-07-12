import { MakeAction } from "#lib/actions/actions";
import { drainGameProfileDirtyFully } from "#lib/jobs/drain-dirty-queues";
import { EnqueueAllGameProfilesDirty } from "#utils/calculations/recalc-scores";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_RecalcAllGameProfiles = MakeAction(
	"RECALC_ALL_GAME_PROFILES",
	async (taker) => {
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		await EnqueueAllGameProfilesDirty();
		await drainGameProfileDirtyFully();

		return {};
	},
);
