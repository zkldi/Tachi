import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { ExpectedErr } from "bliss";
import { ALL_PERMISSIONS } from "tachi-common";

const VALID_PERMISSIONS = new Set(Object.keys(ALL_PERMISSIONS));

function permissionsToColumns(perms: Array<string>) {
	return {
		pm_customise_profile: perms.includes("customise_profile") ? true : null,
		pm_customise_score: perms.includes("customise_score") ? true : null,
		pm_customise_session: perms.includes("customise_session") ? true : null,
		pm_delete_score: perms.includes("delete_score") ? true : null,
		pm_manage_rivals: perms.includes("manage_rivals") ? true : null,
		pm_manage_targets: perms.includes("manage_targets") ? true : null,
		pm_submit_score: perms.includes("submit_score") ? true : null,
		pm_manage_challenges: perms.includes("manage_challenges") ? true : null,
	};
}

export const ACTION_CreateApiToken = MakeAction(
	"CREATE_API_TOKEN",
	async (taker, { clientID, permissions, identifier }) => {
		if (clientID !== undefined && permissions !== undefined) {
			throw new ExpectedErr(400, "Cannot use clientID and permissions at the same time.");
		}

		let tokenIdentifier: string;
		let fromOauth2Client: string | null = null;
		let permColumns: ReturnType<typeof permissionsToColumns>;

		if (clientID !== undefined) {
			const client = await DB.selectFrom("priv_api_client")
				.select([
					"client_id",
					"name",
					"pm_customise_profile",
					"pm_customise_score",
					"pm_customise_session",
					"pm_delete_score",
					"pm_manage_rivals",
					"pm_manage_targets",
					"pm_submit_score",
					"pm_manage_challenges",
				])
				.where("client_id", "=", clientID)
				.executeTakeFirst();

			if (!client) {
				throw new ExpectedErr(404, "This client does not exist.");
			}

			const existing = await DB.selectFrom("priv_api_token")
				.select("token")
				.where("user_id", "=", taker.acct.id)
				.where("from_oauth2_client", "=", clientID)
				.executeTakeFirst();

			if (existing) {
				return { token: existing.token, wasExisting: true };
			}

			tokenIdentifier = client.name;
			fromOauth2Client = client.client_id;
			permColumns = {
				pm_customise_profile: client.pm_customise_profile,
				pm_customise_score: client.pm_customise_score,
				pm_customise_session: client.pm_customise_session,
				pm_delete_score: client.pm_delete_score,
				pm_manage_rivals: client.pm_manage_rivals,
				pm_manage_targets: client.pm_manage_targets,
				pm_submit_score: client.pm_submit_score,
				pm_manage_challenges: client.pm_manage_challenges,
			};
		} else if (permissions !== undefined) {
			const invalid = permissions.filter((p) => !VALID_PERMISSIONS.has(p));

			if (invalid.length > 0) {
				throw new ExpectedErr(400, `Invalid permissions: ${invalid.join(", ")}`);
			}

			tokenIdentifier = identifier ?? "Custom Token";
			permColumns = permissionsToColumns(permissions);
		} else {
			throw new ExpectedErr(
				400,
				"Invalid request, must specify either clientID or permissions.",
			);
		}

		const token = Random20Hex();

		await DB.insertInto("priv_api_token")
			.values({
				token,
				user_id: taker.acct.id,
				identifier: tokenIdentifier,
				from_oauth2_client: fromOauth2Client,
				...permColumns,
			})
			.execute();

		return { token, wasExisting: false };
	},
);
