import { MakeAction } from "#lib/actions/actions";
import { SELECT_USER, ToUserDocument } from "#lib/db-formats/user";
import { GetTotalAllowedInvites } from "#lib/invites/invites";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";

/** First arg to `pg_advisory_xact_lock`; namespaces this lock vs any other advisory locks in the DB. */
const CREATE_INVITE_ADVISORY_KEY1 = 0x54_61_63_68; // "Tach"

export const ACTION_CreateInvite = MakeAction("CREATE_INVITE", async (taker) => {
	const userId = taker.acct.id;

	return DB.transaction().execute(async (trx) => {
		await sql`select pg_advisory_xact_lock(${CREATE_INVITE_ADVISORY_KEY1}, ${userId})`.execute(
			trx,
		);

		const isAdmin = await trx
			.selectFrom("account")
			.select("auth_level")
			.where("id", "=", userId)
			.where("auth_level", "=", "admin")
			.executeTakeFirst()
			.then((row) => !!row);

		if (!isAdmin) {
			const userRow = await trx
				.selectFrom("account")
				.select(SELECT_USER)
				.where("id", "=", userId)
				.executeTakeFirstOrThrow();

			const userDoc = ToUserDocument(userRow);

			const { count } = await trx
				.selectFrom("priv_invite")
				.select(trx.fn.countAll().as("count"))
				.where("created_by", "=", userId)
				.executeTakeFirstOrThrow();

			if (Number(count) >= GetTotalAllowedInvites(userDoc)) {
				throw new ExpectedErr(
					400,
					"You already have your maximum amount of outgoing invites.",
				);
			}
		}

		const code = Random20Hex();
		const createdAt = new Date().toISOString();

		await trx
			.insertInto("priv_invite")
			.values({
				code,
				created_by: userId,
				created_at: createdAt,
				consumed: false,
				consumed_by: null,
				consumed_at: null,
			})
			.execute();

		return {
			code,
			createdBy: userId,
			createdAt: ISO8601ToUnixMilliseconds(createdAt),
			consumed: false,
			consumedAt: null,
			consumedBy: null,
		};
	});
});
