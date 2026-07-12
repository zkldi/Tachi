import { type Selection } from "kysely";
import { type MytCardInfo } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_MYT_CARD_INFO = [
	"priv_svc_myt_card_info.user_id",
	"priv_svc_myt_card_info.card_access_code",
] as const;

export function ToMytCardInfo(
	row: Selection<Database, "priv_svc_myt_card_info", (typeof SELECT_MYT_CARD_INFO)[number]>,
): MytCardInfo {
	return {
		userID: row.user_id,
		cardAccessCode: row.card_access_code,
	};
}
