import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_UpdateKshookSv6cSettings = MakeAction(
	"UPDATE_KSHOOK_SV6C_SETTINGS",
	async (taker, { forceStaticImport }) => {
		await DB.insertInto("svc_kshook_sv6c_settings")
			.values({ user_id: taker.acct.id, force_static_import: forceStaticImport })
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({ force_static_import: forceStaticImport }),
			)
			.execute();

		return { forceStaticImport };
	},
);
