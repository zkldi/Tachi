import { type Selection } from "kysely";
import { type CGCardInfo } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_CG_CARD_INFO = [
	"priv_svc_cg_card_info.user_id",
	"priv_svc_cg_card_info.service",
	"priv_svc_cg_card_info.card_id",
	"priv_svc_cg_card_info.pin",
] as const;

export function ToCGCardInfo(
	row: Selection<Database, "priv_svc_cg_card_info", (typeof SELECT_CG_CARD_INFO)[number]>,
): CGCardInfo {
	return {
		userID: row.user_id,
		service: row.service as CGCardInfo["service"],
		cardID: row.card_id,
		pin: row.pin,
	};
}
