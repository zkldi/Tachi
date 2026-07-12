import { MakeAction } from "#lib/actions/actions";
import { HashPassword, PasswordCompare } from "#lib/auth/auth";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_ChangePassword = MakeAction(
	"CHANGE_PASSWORD",
	async (taker, { "!oldPassword": oldPassword, "!password": password }) => {
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

				const isPasswordValid = await PasswordCompare(oldPassword, pw.password);

				if (!isPasswordValid) {
					throw new ExpectedErr(401, "Invalid password");
				}

				const newPasswordHash = await HashPassword(password);

				await txn
					.updateTable("priv_account_credential")
					.set({
						password: newPasswordHash,
					})
					.where("user_id", "=", taker.acct.id)
					.execute();
			});

		return {};
	},
);
