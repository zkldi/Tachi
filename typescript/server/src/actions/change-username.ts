import { MakeAction } from "#lib/actions/actions";
import { PasswordCompare } from "#lib/auth/auth";
import DB from "#services/pg/db";
import { NowISO8601 } from "#utils/time";
import { CanChangeUsername } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_ChangeUsername = MakeAction(
	"CHANGE_USERNAME",
	async (taker, { newUsername, "!password": password }) => {
		if (taker.acct.username === newUsername) {
			throw new ExpectedErr(400, "New username is the same as the old username");
		}

		await DB.transaction()
			.setIsolationLevel("serializable")
			.execute(async (txn) => {
				const pw = await txn
					.selectFrom("priv_account_credential")
					.select("password")
					.where("user_id", "=", taker.acct.id)
					.executeTakeFirstOrThrow();

				if (!pw) {
					throw new ExpectedErr(500, "User has no password?");
				}

				const isPasswordValid = await PasswordCompare(password, pw.password);

				if (!isPasswordValid) {
					throw new ExpectedErr(401, "Invalid password");
				}

				const canChangeUsername = await CanChangeUsername(txn, taker.acct.id);

				if (!canChangeUsername) {
					throw new ExpectedErr(400, "You can only change your username every 6 months.");
				}

				await txn
					.insertInto("account_username_change")
					.values({
						user_id: taker.acct.id,
						username: newUsername,
						previous_username: taker.acct.username,
						timestamp: NowISO8601(),
					})
					.execute();

				await txn
					.updateTable("account")
					.set({ username: newUsername })
					.where("id", "=", taker.acct.id)
					.execute();
			});

		return { prevUsername: taker.acct.username, newUsername };
	},
);
