/**
 * Anonymises an in-place copy of the Tachi Postgres database so it can be
 * distributed as a public dataset.
 *
 * NEVER run this against the live production database.
 *
 * Safety guard: the database name in the connection URL must contain "anon".
 *
 * Usage:
 *   bun run src/scripts/anonymise-db.ts -- --url postgresql://localhost/anon-kamai
 */

import type { Database } from "tachi-db";

import { Kysely, PostgresDialect, sql } from "kysely";
import { parseArgs } from "node:util";
import pg from "pg";

// Pre-computed bcrypt12 hash of the literal string "password".
// Allows anyone loading the dataset to log in as any user with that password.
const ANON_PASSWORD_HASH = "$2b$12$QRFCAxvFoNI2spszFPgt/e.qLy55GvYWlSHioa0AujRbFpChLwHmu";

function printHelp(): void {
	console.log(`
anonymise-db — strip PII from a copy of the Tachi Postgres database

  --url <postgres-url>   Connection string for the database to anonymise.
                         The database name MUST contain "anon".
  -h, --help             Show this help

NEVER run against the production database.
`);
}

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		url: { type: "string" },
		help: { type: "boolean", short: "h" },
	},
});

if (values.help) {
	printHelp();
	process.exit(0);
}

const url = values.url;

if (!url) {
	console.error("anonymise-db: --url is required.");
	printHelp();
	process.exit(1);
}

// Safety: refuse to run against anything that doesn't look like an anonymisation copy.
// The connection string must contain "anon" to prevent accidentally destroying real data.
if (!url.includes("anon")) {
	console.error(
		`anonymise-db: refusing to run against "${url}". ` +
			`The connection string must contain "anon" (e.g. postgresql://localhost/anon-kamai).`,
	);
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

const DB = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});

async function main(): Promise<void> {
	console.log(`[anonymise-db] Connected to ${url}.`);

	// ── 1. ANONYMIZE: scrub PII fields, keep the rows ──────────────────────

	console.log("[anonymise-db] Anonymising priv_account_credential…");
	await DB.updateTable("priv_account_credential")
		.set({
			password: ANON_PASSWORD_HASH,
			email: sql<string>`priv_account_credential.user_id::text || '@example.com'`,
		})
		.execute();

	console.log("[anonymise-db] Anonymising account…");
	await DB.updateTable("account")
		.set({
			username: sql<string>`'user' || account.id::text`,
			sm_discord: null,
			sm_twitter: null,
			sm_github: null,
			sm_steam: null,
			sm_youtube: null,
			sm_twitch: null,
			custom_pfp_location: null,
			custom_banner_location: null,
			about: "Example About Me",
			status: null,
			is_supporter: false,
			auth_level: "user",
			bd_alpha: false,
			bd_beta: false,
			bd_dev_team: false,
		})
		.execute();

	console.log("[anonymise-db] Anonymising session names…");
	await DB.updateTable("session")
		.set({
			name: "Untitled Session",
			description: null,
		})
		.execute();

	console.log("[anonymise-db] Nulling score comments…");
	await DB.updateTable("score").set({ comment: null }).execute();

	// ── 2. TRUNCATE: remove all rows from every table NOT in the whitelist ────
	//
	// Using a whitelist (rather than a blacklist) means any table added to the
	// schema in the future is automatically emptied — it can never accidentally
	// slip through into a public dataset.
	//
	// Tables are truncated in a single statement so Postgres handles FK
	// dependency ordering automatically.

	const KEEP_TABLES = new Set([
		"_migration",
		"account", // anonymised above
		"account_following",
		"account_settings",
		"bms_course_lookup",
		"chart",
		"chart_leaderboard",
		"class_achievement",
		"folder",
		"folder_chart_lookup",
		"folder_view",
		"game_profile",
		"game_rival",
		"game_stats_snapshot",
		"goal",
		"goal_sub",
		"import",
		"import_class",
		"import_error",
		"import_game",
		"import_goal",
		"import_quest",
		"import_session",
		"import_timing",
		"orphan_chart",
		"orphan_chart_user",
		"pb",
		"pb_composed_from",
		"priv_account_credential", // anonymised above
		"quest",
		"quest_sub",
		"questline",
		"questline_quest",
		"score", // comment nulled above
		"score_blacklist",
		"session", // name/description anonymised above
		"song",
		"svc_fer_settings",
		"svc_kshook_sv6c_settings",
		"table",
		"table_folder",
	]);

	const { rows: allTableRows } = await sql<{ table_name: string }>`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`.execute(DB);

	const toTruncate = allTableRows
		.map((r) => r.table_name)
		.filter((name) => !KEEP_TABLES.has(name));

	if (toTruncate.length === 0) {
		console.log("[anonymise-db] No tables to truncate (all tables are whitelisted).");
	} else {
		console.log(
			`[anonymise-db] Truncating ${toTruncate.length} non-whitelisted table(s): ${toTruncate.join(", ")}`,
		);
		await sql`TRUNCATE TABLE ${sql.join(
			toTruncate.map((t) => sql.id(t)),
			sql`, `,
		)}`.execute(DB);
	}

	console.log("[anonymise-db] Done. Database is ready for pg_dump.");
	await pool.end();
}

await main().catch((err: unknown) => {
	console.error("[anonymise-db] Fatal error:", err);
	process.exit(1);
});
