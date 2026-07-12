import { type Selection } from "kysely";
import { type FervidexSettingsDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_FER_SETTINGS = [
	"svc_fer_settings.user_id",
	"svc_fer_settings.force_static_import",
] as const;

export function ToFervidexSettingsDocument(
	row: Selection<Database, "svc_fer_settings", (typeof SELECT_FER_SETTINGS)[number]>,
	cards: Array<string> | null,
): FervidexSettingsDocument {
	return {
		userID: row.user_id,
		cards,
		forceStaticImport: row.force_static_import,
	};
}
