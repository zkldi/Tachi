import {
	ACTION_BMSTableSync,
	SyncBMSTables,
	syncBmsTablesCore,
	UpdateTable,
} from "#actions/bms-table-sync";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { log } from "#lib/log/log";
import { WrapScriptPromise } from "#utils/misc";

export { ACTION_BMSTableSync, SyncBMSTables, syncBmsTablesCore, UpdateTable };

if (require.main === module) {
	void (async () => {
		const taker = await DefaultAdminUser.actionTaker();
		await WrapScriptPromise(ACTION_BMSTableSync(taker, {}), log);
	})();
}
