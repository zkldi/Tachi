import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { importSeeds } from "#services/pg/seeds";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_ImportSeeds = MakeAction(
	"IMPORT_SEEDS",
	async (taker, { commitHash, seedsDir }) => {
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		log.info(`Importing seeds from ${seedsDir} (commit=${commitHash}).`);

		await importSeeds(DB, seedsDir);

		return {};
	},
);
