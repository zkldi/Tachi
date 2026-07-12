import { MakeAnonAction } from "#lib/actions/actions";
import { SELECT_API_TOKEN, ToAPITokenDocument } from "#lib/db-formats/api-token";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { ExpectedErr } from "bliss";
import crypto from "node:crypto";

const SELECT_OAUTH_CLIENT = [
	"priv_api_client.client_id",
	"priv_api_client.client_secret",
	"priv_api_client.name",
	"priv_api_client.redirect_uri",
	"priv_api_client.pm_customise_profile",
	"priv_api_client.pm_customise_score",
	"priv_api_client.pm_customise_session",
	"priv_api_client.pm_delete_score",
	"priv_api_client.pm_manage_rivals",
	"priv_api_client.pm_manage_targets",
	"priv_api_client.pm_submit_score",
	"priv_api_client.pm_manage_challenges",
] as const;

export const ANON_ACTION_OAuthTokenExchange = MakeAnonAction(
	"OAUTH_TOKEN_EXCHANGE",
	async (_taker, input) => {
		const client = await DB.selectFrom("priv_api_client")
			.select(SELECT_OAUTH_CLIENT)
			.where("client_id", "=", input.client_id)
			.executeTakeFirst();

		if (!client) {
			throw new ExpectedErr(404, `This client does not exist.`);
		}

		const expectedBuf = Buffer.from(client.client_secret, "utf8");
		const receivedBuf = Buffer.from(String(input.client_secret), "utf8");

		if (
			expectedBuf.length !== receivedBuf.length ||
			!crypto.timingSafeEqual(expectedBuf, receivedBuf)
		) {
			throw new ExpectedErr(403, `Invalid secret.`);
		}

		if (client.redirect_uri !== input.redirect_uri) {
			throw new ExpectedErr(
				400,
				`This redirect_uri does not match with your registered client redirect_uri ${client.redirect_uri}.`,
			);
		}

		const apiToken = Random20Hex();
		const identifier = `${client.name} Token`;

		await DB.transaction().execute(async (txn) => {
			const deleted = await txn
				.deleteFrom("priv_oauth2_auth_token")
				.where("token", "=", input.code)
				.returning("user_id")
				.executeTakeFirst();

			if (!deleted) {
				throw new ExpectedErr(404, `This code does not exist.`);
			}

			await txn
				.insertInto("priv_api_token")
				.values({
					token: apiToken,
					user_id: deleted.user_id,
					identifier,
					from_oauth2_client: client.client_id,
					pm_customise_profile: client.pm_customise_profile,
					pm_customise_score: client.pm_customise_score,
					pm_customise_session: client.pm_customise_session,
					pm_delete_score: client.pm_delete_score,
					pm_manage_rivals: client.pm_manage_rivals,
					pm_manage_targets: client.pm_manage_targets,
					pm_submit_score: client.pm_submit_score,
					pm_manage_challenges: client.pm_manage_challenges,
				})
				.execute();
		});

		const row = await DB.selectFrom("priv_api_token")
			.select(SELECT_API_TOKEN)
			.where("token", "=", apiToken)
			.executeTakeFirstOrThrow();

		const doc = ToAPITokenDocument(row);

		return {
			userID: Number(doc.userID),
			token: doc.token!,
			identifier: doc.identifier,
			permissions: doc.permissions as Record<string, boolean>,
			fromAPIClient: doc.fromAPIClient,
		};
	},
);
