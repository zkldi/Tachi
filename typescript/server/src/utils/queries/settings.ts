import DB from "#services/pg/db";
import { type integer } from "tachi-common";

export async function GetFollowingForUser(userID: integer): Promise<Array<integer>> {
	const results = await DB.selectFrom("account_following")
		.select("followee")
		.where("user_id", "=", userID)
		.execute();

	return results.map((r) => r.followee);
}
