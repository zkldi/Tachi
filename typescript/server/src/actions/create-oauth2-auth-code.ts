import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { ExpectedErr } from "bliss";

export const ACTION_CreateOAuth2AuthCode = MakeAction(
	"CREATE_OAUTH2_AUTH_CODE",
	async (taker, input) => {
		if ((input.codeChallenge === undefined) !== (input.codeChallengeMethod === undefined)) {
			throw new ExpectedErr(
				400,
				"Both code_challenge and code_challenge_method must be provided together.",
			);
		}

		const code = Random20Hex();
		const createdOn = Date.now();

		await DB.insertInto("priv_oauth2_auth_token")
			.values({
				token: code,
				user_id: taker.acct.id,
				created_on: new Date(createdOn).toISOString(),
				code_challenge: input.codeChallenge ?? null,
				code_challenge_method: input.codeChallengeMethod ?? null,
			})
			.execute();

		return {
			code,
			userID: taker.acct.id,
			createdOn,
		};
	},
);
