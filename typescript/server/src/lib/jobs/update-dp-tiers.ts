import { ACTION_UpdateDpTiers, updateDpTiersCore } from "#actions/update-dp-tiers";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { log } from "#lib/log/log";
import { WrapScriptPromise } from "#utils/misc";

export { ACTION_UpdateDpTiers, updateDpTiersCore };

if (require.main === module) {
	void (async () => {
		const taker = await DefaultAdminUser.actionTaker();
		await WrapScriptPromise(ACTION_UpdateDpTiers(taker, {}), log);
	})();
}
