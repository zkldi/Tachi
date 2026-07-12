import { ACTION_UpdateSp12Data, updateSp12DataCore } from "#actions/update-sp12-data";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { log } from "#lib/log/log";
import { WrapScriptPromise } from "#utils/misc";

export { ACTION_UpdateSp12Data, updateSp12DataCore };

if (require.main === module) {
	void (async () => {
		const taker = await DefaultAdminUser.actionTaker();
		await WrapScriptPromise(ACTION_UpdateSp12Data(taker, {}), log);
	})();
}
