/**
 * Re-import Mongo `api-clients` → Postgres `priv_api_client` and Mongo `api-tokens` → `priv_api_token`.
 *
 * Use after correcting permission-field mapping bugs — upserts Mongo rows into Postgres (overwrite on PK conflict).
 *
 * Postgres dependency order:
 *   If you truncate tokens only: `TRUNCATE priv_api_token;`
 *   If you redo clients too (recommended when fixing client permission columns):
 *       `TRUNCATE priv_api_token, priv_api_client;`
 *     (ordering does not matter in one statement; tokens must be cleared if you truncate clients.)
 *
 * Heads-up: `priv_discord_user_map` FKs into `priv_api_token` — resetting tokens may unlink Discord API mapping rows until you reconcile.
 *
 * Env:
 *   MONGO_URL     — MongoDB URL (default: mongodb://mongo/tachi)
 *   POSTGRES_URL  — required
 *
 * From `typescript/server`:
 *   MONGO_URL=... POSTGRES_URL=... bun run src/scripts/reimport-priv-api-from-mongo.ts
 */

import type { Database, NewPrivApiClient, NewPrivApiToken } from "tachi-db";

import { type Insertable, Kysely, PostgresDialect, type RawBuilder, sql } from "kysely";
import monk from "monk";
import { Pool } from "pg";

import type {
	MongoApiClientsCollectionDocument,
	MongoApiTokensCollectionDocument,
} from "./migrate-to-postgres.mongo-docs";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://mongo/tachi";
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
	console.error("[reimport-priv-api] POSTGRES_URL is not set.");
	process.exit(1);
}

const mongoDB = monk(MONGO_URL);

const pg = new Kysely<Database>({
	dialect: new PostgresDialect({
		pool: new Pool({ connectionString: POSTGRES_URL }),
	}),
});

// ── Same permission normalization as migrate-to-postgres.ts ─────────────────

function permissionKeyDashVariant(canonicalUnderscoreKey: string): string {
	return canonicalUnderscoreKey.replaceAll("_", "-");
}

/** requestedPermissions entries may use underscore (`customise_profile`) or dashed legacy strings. */
function perm(permissions: Array<string>, canonicalUnderscoreKey: string): boolean | null {
	const dashed = permissionKeyDashVariant(canonicalUnderscoreKey);

	return permissions.includes(canonicalUnderscoreKey) || permissions.includes(dashed)
		? true
		: null;
}

function permRec(
	permissions: Record<string, boolean>,
	canonicalUnderscoreKey: string,
): boolean | null {
	const dashed = permissionKeyDashVariant(canonicalUnderscoreKey);

	if (Object.hasOwn(permissions, canonicalUnderscoreKey)) {
		return permissions[canonicalUnderscoreKey]!;
	}

	if (Object.hasOwn(permissions, dashed)) {
		return permissions[dashed]!;
	}

	return null;
}

const INSERT_CHUNK = 500;

/** ON CONFLICT DO UPDATE — set each column from the proposed row (`excluded`). */
function onConflictExcludedAll(
	exampleRow: Record<string, unknown>,
): Record<string, RawBuilder<unknown>> {
	const toSet: Record<string, RawBuilder<unknown>> = {};

	for (const key of Object.keys(exampleRow)) {
		toSet[key] = sql`excluded.${sql.ref(key)}`;
	}

	return toSet;
}

async function batchUpsertPrivApiClient(
	rows: ReadonlyArray<Insertable<Database["priv_api_client"]>>,
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
		const chunk = rows.slice(i, i + INSERT_CHUNK);
		// Sequential chunks — avoid oversized multi-row INSERT payloads.
		// eslint-disable-next-line no-await-in-loop -- bounded batch upserts
		await pg
			.insertInto("priv_api_client")
			.values(chunk as never)
			.onConflict((oc) =>
				oc
					.column("client_id")
					.doUpdateSet(onConflictExcludedAll(chunk[0] as Record<string, unknown>)),
			)
			.execute();
	}
}

async function batchUpsertPrivApiToken(
	rows: ReadonlyArray<Insertable<Database["priv_api_token"]>>,
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
		const chunk = rows.slice(i, i + INSERT_CHUNK);
		// eslint-disable-next-line no-await-in-loop -- bounded batch upserts
		await pg
			.insertInto("priv_api_token")
			.values(chunk as never)
			.onConflict((oc) =>
				oc
					.column("token")
					.doUpdateSet(onConflictExcludedAll(chunk[0] as Record<string, unknown>)),
			)
			.execute();
	}
}

function getFromApiClient(doc: MongoApiTokensCollectionDocument): string | null {
	const d = doc as {
		fromOAuth2Client?: string | null;
	} & MongoApiTokensCollectionDocument;
	if (typeof d.fromOAuth2Client === "string") {
		return d.fromOAuth2Client;
	}
	return d.fromAPIClient;
}

function mapApiClientRow(c: MongoApiClientsCollectionDocument): NewPrivApiClient {
	const extended = c as {
		redirectURI?: string | null;
		redirectUri?: string | null;
		webhookURI?: string | null;
		webhookUri?: string | null;
	} & MongoApiClientsCollectionDocument;

	const p = c.requestedPermissions as unknown as Array<string>;

	return {
		client_id: c.clientID,
		client_secret: c.clientSecret,
		name: c.name,
		author: c.author,
		pm_customise_profile: perm(p, "customise_profile"),
		pm_customise_score: perm(p, "customise_score"),
		pm_customise_session: perm(p, "customise_session"),
		pm_delete_score: perm(p, "delete_score"),
		pm_manage_rivals: perm(p, "manage_rivals"),
		pm_manage_targets: perm(p, "manage_targets"),
		pm_submit_score: perm(p, "submit_score"),
		pm_manage_challenges: perm(p, "manage_challenges"),
		api_key_template: c.apiKeyTemplate,
		api_key_filename: c.apiKeyFilename,
		redirect_uri: extended.redirectUri ?? extended.redirectURI ?? null,
		webhook_uri: extended.webhookUri ?? extended.webhookURI ?? null,
	};
}

async function main(): Promise<void> {
	console.log("[reimport-priv-api] fetching api-clients from Mongo...");
	const clients = await mongoDB.get<MongoApiClientsCollectionDocument>("api-clients").find({});

	const clientRows: Array<NewPrivApiClient> = clients.map((c) => mapApiClientRow(c));

	console.log(
		`[reimport-priv-api] upserting ${clientRows.length} row(s) into priv_api_client (conflict target: client_id)...`,
	);

	await batchUpsertPrivApiClient(clientRows);

	console.log("[reimport-priv-api] fetching api-tokens from Mongo...");
	const apiTokens = await mongoDB.get<MongoApiTokensCollectionDocument>("api-tokens").find({});

	const existingClientIds = new Set(
		(await pg.selectFrom("priv_api_client").select("client_id").execute()).map(
			(r) => r.client_id,
		),
	);

	const validTokens = apiTokens.filter((t) => {
		const fromClient = getFromApiClient(t);
		return (
			t.token !== null &&
			t.userID !== null &&
			(fromClient === null || fromClient === undefined || existingClientIds.has(fromClient))
		);
	});

	if (validTokens.length !== apiTokens.length) {
		console.warn(
			`[reimport-priv-api] Skipping ${apiTokens.length - validTokens.length} token row(s): null token/userID or dangling oauth client`,
		);
	}

	const tokenRows: Array<NewPrivApiToken> = validTokens.map((t) => {
		const fromClient = getFromApiClient(t);

		const p =
			t.permissions && typeof t.permissions === "object"
				? t.permissions
				: ({} as Record<string, boolean>);

		return {
			token: t.token!,
			user_id: t.userID!,
			identifier: t.identifier,
			pm_customise_profile: permRec(p, "customise_profile"),
			pm_customise_score: permRec(p, "customise_score"),
			pm_customise_session: permRec(p, "customise_session"),
			pm_delete_score: permRec(p, "delete_score"),
			pm_manage_rivals: permRec(p, "manage_rivals"),
			pm_manage_targets: permRec(p, "manage_targets"),
			pm_submit_score: permRec(p, "submit_score"),
			pm_manage_challenges: permRec(p, "manage_challenges"),
			from_oauth2_client: fromClient ?? null,
		};
	});

	console.log(
		`[reimport-priv-api] upserting ${tokenRows.length} row(s) into priv_api_token (conflict target: token)...`,
	);

	await batchUpsertPrivApiToken(tokenRows);

	console.log("[reimport-priv-api] done.");

	await mongoDB.close();
	await pg.destroy();
}

main().catch((err) => {
	console.error("[reimport-priv-api]", err);

	process.exit(1);
});
