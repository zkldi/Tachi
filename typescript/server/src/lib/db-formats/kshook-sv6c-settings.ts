import { type Selection } from "kysely";
import { type KsHookSettingsDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_KSHOOK_SV6C_SETTINGS = [
	"svc_kshook_sv6c_settings.user_id",
	"svc_kshook_sv6c_settings.force_static_import",
] as const;

export function ToKshookSv6cSettings(
	row: Selection<
		Database,
		"svc_kshook_sv6c_settings",
		(typeof SELECT_KSHOOK_SV6C_SETTINGS)[number]
	>,
): KsHookSettingsDocument {
	return {
		userID: row.user_id,
		forceStaticImport: row.force_static_import,
	};
}
