import { type Kysely, type Transaction } from "kysely";
import { type Database } from "tachi-db";

export type KaiService = "EAG" | "FLO" | "MIN";

export async function upsertKaiAuthTokensInDb(
	db: Kysely<Database> | Transaction<Database>,
	userId: number,
	service: KaiService,
	token: string,
	refreshToken: string,
): Promise<void> {
	await db
		.insertInto("priv_svc_kai_auth_token")
		.values({
			user_id: userId,
			service,
			token,
			refresh_token: refreshToken,
		})
		.onConflict((oc) =>
			oc.columns(["user_id", "service"]).doUpdateSet({
				token,
				refresh_token: refreshToken,
			}),
		)
		.execute();
}

export async function updateKaiAuthTokensInDb(
	db: Kysely<Database> | Transaction<Database>,
	userId: number,
	service: KaiService,
	token: string,
	refreshToken: string,
): Promise<void> {
	await db
		.updateTable("priv_svc_kai_auth_token")
		.set({
			token,
			refresh_token: refreshToken,
		})
		.where("user_id", "=", userId)
		.where("service", "=", service)
		.execute();
}
