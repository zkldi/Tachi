import { MakeAction } from "#lib/actions/actions";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_FollowUser = MakeAction("FOLLOW_USER", async (taker, { userID: toFollow }) => {
	if (taker.acct.id === toFollow) {
		throw new ExpectedErr(400, "Can't follow yourself. Bit self-indulgent!");
	}

	const existingFollow = await DB.selectFrom("account_following")
		.select("followee")
		.where("user_id", "=", taker.acct.id)
		.where("followee", "=", toFollow)
		.executeTakeFirst();

	if (existingFollow) {
		throw new ExpectedErr(409, "You are already following this user.");
	}

	const { count } = await DB.selectFrom("account_following")
		.select(DB.fn.countAll<number>().as("count"))
		.where("user_id", "=", taker.acct.id)
		.executeTakeFirstOrThrow();

	if (Number(count) >= ServerConfig.MAX_FOLLOWING_AMOUNT) {
		throw new ExpectedErr(
			400,
			`You are following too many people. The max is ${ServerConfig.MAX_FOLLOWING_AMOUNT}.`,
		);
	}

	const userToFollow = await GetUserWithID(toFollow);

	if (!userToFollow) {
		throw new ExpectedErr(400, `No user with the id '${toFollow}' exists.`);
	}

	await DB.insertInto("account_following")
		.values({ user_id: taker.acct.id, followee: toFollow })
		.execute();

	return { username: userToFollow.username };
});
