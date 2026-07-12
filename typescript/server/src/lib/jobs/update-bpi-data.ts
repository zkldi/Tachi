import { ACTION_UpdateBpiData, updateBpiDataCore } from "#actions/update-bpi-data";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { log } from "#lib/log/log";
import { WrapScriptPromise } from "#utils/misc";

export { ACTION_UpdateBpiData, updateBpiDataCore };

if (require.main === module) {
	void (async () => {
		const taker = await DefaultAdminUser.actionTaker();
		await WrapScriptPromise(ACTION_UpdateBpiData(taker, {}), log);
	})();
}
