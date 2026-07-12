import { SELECT_API_TOKEN } from "#lib/db-formats/api-token";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";

export { seedUser };

// ─── seedApiClient ────────────────────────────────────────────────────────────

interface SeedApiClientOpts {
	clientId: string;
	authorId: number;
	name?: string;
	clientSecret?: string;
	submitScore?: boolean;
	customiseProfile?: boolean;
	redirectUri?: string | null;
}

export async function seedApiClient(opts: SeedApiClientOpts) {
	await DB.insertInto("priv_api_client")
		.values({
			client_id: opts.clientId,
			client_secret: opts.clientSecret ?? "CS_test_secret",
			name: opts.name ?? "Test Client",
			author: opts.authorId,
			pm_submit_score: opts.submitScore ?? null,
			pm_customise_profile: opts.customiseProfile ?? null,
			pm_customise_score: null,
			pm_customise_session: null,
			pm_delete_score: null,
			pm_manage_rivals: null,
			pm_manage_targets: null,
			pm_manage_challenges: null,
			api_key_template: null,
			api_key_filename: null,
			webhook_uri: null,
			redirect_uri: opts.redirectUri ?? null,
			is_builtin: false,
		})
		.execute();

	return opts.clientId;
}

// ─── seedApiToken ─────────────────────────────────────────────────────────────

interface SeedApiTokenOpts {
	token: string;
	userId: number;
	identifier?: string;
	fromClient?: string | null;
	submitScore?: boolean;
	customiseSession?: boolean;
}

export async function seedApiToken(opts: SeedApiTokenOpts) {
	await DB.insertInto("priv_api_token")
		.values({
			token: opts.token,
			user_id: opts.userId,
			identifier: opts.identifier ?? "Test Token",
			from_oauth2_client: opts.fromClient ?? null,
			pm_submit_score: opts.submitScore ?? null,
			pm_customise_profile: null,
			pm_customise_score: null,
			pm_customise_session: opts.customiseSession ?? null,
			pm_delete_score: null,
			pm_manage_rivals: null,
			pm_manage_targets: null,
			pm_manage_challenges: null,
		})
		.execute();

	return opts.token;
}

// ─── getApiToken ──────────────────────────────────────────────────────────────

export async function getApiToken(token: string) {
	return DB.selectFrom("priv_api_token")
		.select(SELECT_API_TOKEN)
		.where("priv_api_token.token", "=", token)
		.executeTakeFirst();
}
