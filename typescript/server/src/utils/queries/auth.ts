import type { KtLogger } from "#lib/log/log";
import type { integer, KaiAuthDocument } from "tachi-common";

import { SELECT_KAI_AUTH_TOKEN, ToKaiAuthDocument } from "#lib/db-formats/kai-auth-token";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import DB from "#services/pg/db";

export async function GetKaiAuth(
	userID: integer,
	service: "EAG" | "FLO" | "MIN",
): Promise<KaiAuthDocument | null> {
	const row = await DB.selectFrom("priv_svc_kai_auth_token")
		.select(SELECT_KAI_AUTH_TOKEN)
		.where("user_id", "=", userID)
		.where("service", "=", service)
		.executeTakeFirst();

	return row ? ToKaiAuthDocument(row) : null;
}

export async function GetKaiAuthGuaranteed(
	userID: integer,
	service: "EAG" | "FLO" | "MIN",
	log: KtLogger,
) {
	const authDoc = await GetKaiAuth(userID, service);

	if (!authDoc) {
		log.warn(`No authentication was stored for ${service}.`);
		throw new ScoreImportFatalError(401, `No authentication was stored for ${service}.`);
	}

	return authDoc;
}
