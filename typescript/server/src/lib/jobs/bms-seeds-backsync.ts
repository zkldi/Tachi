import {
	ACTION_BacksyncBmsPmsSeeds,
	runBacksyncBmsPmsSeedsCore,
} from "#actions/backsync-bms-pms-seeds";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { log } from "#lib/log/log";
import { WrapScriptPromise } from "#utils/misc";

export { ACTION_BacksyncBmsPmsSeeds, runBacksyncBmsPmsSeedsCore };

if (require.main === module) {
	void (async () => {
		const taker = await DefaultAdminUser.actionTaker();
		await WrapScriptPromise(ACTION_BacksyncBmsPmsSeeds(taker, {}), log);
	})();
}
