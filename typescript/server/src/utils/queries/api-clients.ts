import { SELECT_API_CLIENT, ToAPIClientDocument } from "#lib/db-formats/api-client";
import DB from "#services/pg/db";
import { type TachiAPIClientDocument } from "tachi-common";

export function GetClientByID(clientID: string): Promise<TachiAPIClientDocument | null> {
	return DB.selectFrom("priv_api_client")
		.select(SELECT_API_CLIENT)
		.where("client_id", "=", clientID)
		.executeTakeFirst()
		.then((res) => (res ? ToAPIClientDocument(res) : null));
}
