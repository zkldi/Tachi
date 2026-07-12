import { type Selection } from "kysely";
import { type KaiAuthDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_KAI_AUTH_TOKEN = [
	"priv_svc_kai_auth_token.user_id",
	"priv_svc_kai_auth_token.service",
	"priv_svc_kai_auth_token.token",
	"priv_svc_kai_auth_token.refresh_token",
] as const;

export function ToKaiAuthDocument(
	row: Selection<Database, "priv_svc_kai_auth_token", (typeof SELECT_KAI_AUTH_TOKEN)[number]>,
): KaiAuthDocument {
	return {
		userID: row.user_id,
		service: row.service as KaiAuthDocument["service"],
		token: row.token,
		refreshToken: row.refresh_token,
	};
}
