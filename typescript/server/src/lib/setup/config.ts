import { log } from "#lib/log/log";
import { loadServerEnvFile } from "#lib/setup/load-server-env";
import {
	ALL_GAMES,
	allSupportedGameGroups,
	type GameGroup,
	GameToGameGroup,
	type ImportTypes,
	type V3Game,
} from "tachi-common";
import { allImportTypes } from "tachi-common/constants/import-types";
import { z } from "zod";

loadServerEnvFile(process.env.NODE_ENV === "test" ? ".env.test" : ".env");

const oauth2Schema = z.object({
	CLIENT_ID: z.string(),
	CLIENT_SECRET: z.string(),
	REDIRECT_URI: z.string(),
});

const cgConfigSchema = z.object({
	API_KEY: z.string(),
	URL: z.string(),
});

const cdnS3SaveLocationSchema = z.object({
	TYPE: z.literal("S3_BUCKET"),
	ENDPOINT: z.string(),
	ACCESS_KEY_ID: z.string(),
	SECRET_ACCESS_KEY: z.string(),
	BUCKET: z.string(),
	KEY_PREFIX: z.string().optional(),
	REGION: z.string().optional(),
});

const configSchema = z.object({
	CAPTCHA_SECRET_KEY: z.string(),
	SESSION_SECRET: z.string(),
	FLO_API_URL: z.url().optional(),
	EAG_API_URL: z.url().optional(),
	MIN_API_URL: z.url().optional(),
	ARC_API_URL: z.url().optional(),
	MYT_API_HOST: z.string().optional(),

	CG_DEV_CONFIG: cgConfigSchema.optional(),
	CG_NAG_CONFIG: cgConfigSchema.optional(),
	CG_GAN_CONFIG: cgConfigSchema.optional(),

	FLO_OAUTH2_INFO: oauth2Schema.optional(),
	EAG_OAUTH2_INFO: oauth2Schema.optional(),
	MIN_OAUTH2_INFO: oauth2Schema.optional(),
	ARC_AUTH_TOKEN: z.string().optional(),
	MYT_AUTH_TOKEN: z.string().optional(),
	CLIENT_DEV_SERVER: z.string().nullable().optional(),
	RATE_LIMIT: z.number().int().positive().default(500),
	OAUTH_CLIENT_CAP: z.number().int().positive().default(15),
	OPTIONS_ALWAYS_SUCCEEDS: z.boolean().optional(),
	ALLOW_RUNNING_OFFLINE: z.boolean().optional(),
	/**
	 * When true, score import HTTP routes run the import inline (via RunScoreImportOnce) instead of
	 * enqueuing to the Postgres job queue. This should ONLY be set in test environments where no
	 * job-queue worker is running. Never set this in production.
	 */
	INLINE_SCORE_IMPORT: z.boolean().default(false),
	/** Dev/stress: when true, score import HTTP routes use an unlimited score-import rate limiter. */
	DISABLE_SCORE_IMPORT_RATE_LIMIT: z.boolean().default(false),
	ENABLE_METRICS: z.boolean().default(true),
	EMAIL_CONFIG: z.object({
		FROM: z.string(),
		TRANSPORT_OPS: z.any(),
	}),
	USC_QUEUE_SIZE: z.number().int().gte(2).default(3),
	BEATORAJA_QUEUE_SIZE: z.number().int().gte(2).default(3),
	MAX_GOAL_SUBSCRIPTIONS: z.number().int().positive().default(1_000),
	MAX_QUEST_SUBSCRIPTIONS: z.number().int().positive().default(100),
	MAX_FOLLOWING_AMOUNT: z.number().int().positive().default(1_000),
	MAX_RIVALS: z.number().int().positive().default(5),
	OUR_URL: z.string().refine((s) => !s.endsWith("/"), {
		message: "OUR_URL must not end with a trailing slash.",
	}),
	INVITE_CODE_CONFIG: z
		.object({
			BATCH_SIZE: z.number().int().nonnegative(),
			INVITE_CAP: z.number().int().nonnegative(),
			BETA_USER_BONUS: z.number().int().nonnegative(),
		})
		.optional(),
	INVITE_ADMIN_INITIAL_INVITE_CODE: z.string().optional(),
	TACHI_CONFIG: z.object({
		NAME: z.string(),
		TYPE: z.enum(["kamai", "boku", "omni"]),
		GAME_GROUPS: z.array(z.enum(allSupportedGameGroups as [GameGroup, ...GameGroup[]])),
		IMPORT_TYPES: z.array(z.enum(allImportTypes as [ImportTypes, ...ImportTypes[]])),
		SIGNUPS_ENABLED: z.boolean().default(true),
		QUEST_PROPOSALS_ENABLED: z.boolean(),
	}),
	CDN_CONFIG: z.object({
		WEB_LOCATION: z.string(),
		SAVE_LOCATION: cdnS3SaveLocationSchema,
		SAVE_LOCATION_PRIVATE: cdnS3SaveLocationSchema,
	}),
	SEEDS_CONFIG: z
		.union([
			z.object({
				TYPE: z.literal("GIT_REPO"),
				REPO_URL: z.string(),
				USER_NAME: z.string().nullable(),
				USER_EMAIL: z.string().nullable(),
				BRANCH: z.string().optional(),
			}),
			z.object({
				TYPE: z.literal("LOCAL_FILES"),
				PATH: z.string(),
			}),
		])
		.optional(),
	GITHUB_APP_CONFIG: z
		.object({
			APP_ID: z.string(),
			PRIVATE_KEY: z.string(),
			INSTALLATION_ID: z.number().int(),
			REPO_OWNER: z.string(),
			REPO_NAME: z.string(),
			/** Shared secret for the webhook endpoint that marks proposals as merged. */
			WEBHOOK_SECRET: z.string(),
		})
		.optional(),
});

export type OAuth2Info = z.infer<typeof oauth2Schema>;
export type CGConfig = z.infer<typeof cgConfigSchema>;
export type TachiServerConfig = z.infer<typeof configSchema>;

function req(key: string): string {
	const v = process.env[key];
	if (v === undefined || v === "") {
		log.error(`${key} is not set. Terminating.`);
		process.exit(1);
	}
	return v;
}

function opt(key: string): string | undefined {
	const v = process.env[key];
	if (v === undefined || v === "") {
		return undefined;
	}
	return v;
}

function optUrl(key: string): string | undefined {
	return opt(key);
}

function parseBool(key: string, defaultVal?: boolean): boolean | undefined {
	const v = opt(key);
	if (v === undefined) {
		return defaultVal;
	}
	if (v === "true" || v === "1") {
		return true;
	}
	if (v === "false" || v === "0") {
		return false;
	}
	return defaultVal;
}

function parseIntEnv(key: string, defaultVal: number): number {
	const v = opt(key);
	if (v === undefined) {
		return defaultVal;
	}
	const n = Number.parseInt(v, 10);
	return Number.isNaN(n) ? defaultVal : n;
}

function parseCsv<T extends string>(key: string, valid: readonly T[]): T[] {
	const raw = req(key);
	const parts = raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const validSet = new Set(valid);
	for (const p of parts) {
		if (!validSet.has(p as T)) {
			throw new Error(`${key} contains invalid value "${p}".`);
		}
	}
	return parts as T[];
}

function oauth2Optional(prefix: "EAG" | "FLO" | "MIN"): z.infer<typeof oauth2Schema> | undefined {
	const id = opt(`TACHI_${prefix}_OAUTH2_CLIENT_ID`);
	const secret = opt(`TACHI_${prefix}_OAUTH2_CLIENT_SECRET`);
	const redirect = opt(`TACHI_${prefix}_OAUTH2_REDIRECT_URI`);
	if (id && secret && redirect) {
		return { CLIENT_ID: id, CLIENT_SECRET: secret, REDIRECT_URI: redirect };
	}
	if (!id && !secret && !redirect) {
		return undefined;
	}
	throw new Error(
		`Incomplete TACHI_${prefix}_OAUTH2_*: set all of CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI, or none.`,
	);
}

function cgOptional(suffix: "DEV" | "GAN" | "NAG"): CGConfig | undefined {
	const apiKey = opt(`TACHI_CG_${suffix}_API_KEY`);
	const url = opt(`TACHI_CG_${suffix}_URL`);
	if (apiKey && url) {
		return { API_KEY: apiKey, URL: url };
	}
	if (!apiKey && !url) {
		return undefined;
	}
	throw new Error(`Incomplete TACHI_CG_${suffix}_*: set both API_KEY and URL, or neither.`);
}

function s3SaveLocation(
	prefix: "TACHI_CDN_SAVE_LOCATION" | "TACHI_CDN_SAVE_LOCATION_PRIVATE",
): z.infer<typeof cdnS3SaveLocationSchema> {
	const keyPrefix = opt(`${prefix}_KEY_PREFIX`);
	const region = opt(`${prefix}_REGION`);
	return {
		TYPE: "S3_BUCKET",
		ENDPOINT: req(`${prefix}_ENDPOINT`),
		ACCESS_KEY_ID: req(`${prefix}_ACCESS_KEY_ID`),
		SECRET_ACCESS_KEY: req(`${prefix}_SECRET_ACCESS_KEY`),
		BUCKET: req(`${prefix}_BUCKET`),
		...(keyPrefix !== undefined ? { KEY_PREFIX: keyPrefix } : {}),
		...(region !== undefined ? { REGION: region } : {}),
	};
}

function githubAppConfig(): TachiServerConfig["GITHUB_APP_CONFIG"] {
	const appId = opt("TACHI_GITHUB_APP_ID");
	if (appId === undefined) {
		return undefined;
	}
	const b64Key = opt("TACHI_GITHUB_APP_BASE64_PRIVATE_KEY");
	const owner = opt("TACHI_GITHUB_REPO_OWNER");
	const repoName = opt("TACHI_GITHUB_REPO_NAME");
	const installationId = opt("TACHI_GITHUB_INSTALLATION_ID");
	const webhookSecret = opt("TACHI_GITHUB_WEBHOOK_SECRET");
	if (!b64Key || !owner || !repoName || !installationId || !webhookSecret) {
		throw new Error(
			"TACHI_GITHUB_APP_ID is set but one or more of TACHI_GITHUB_APP_BASE64_PRIVATE_KEY, TACHI_GITHUB_REPO_OWNER, TACHI_GITHUB_REPO_NAME, TACHI_GITHUB_INSTALLATION_ID, TACHI_GITHUB_WEBHOOK_SECRET are missing.",
		);
	}
	return {
		APP_ID: appId,
		PRIVATE_KEY: Buffer.from(b64Key, "base64").toString("utf-8"),
		REPO_OWNER: owner,
		REPO_NAME: repoName,
		INSTALLATION_ID: Number.parseInt(installationId, 10),
		WEBHOOK_SECRET: webhookSecret,
	};
}

function seedsConfig(): TachiServerConfig["SEEDS_CONFIG"] {
	const type = opt("TACHI_SEEDS_TYPE");
	if (type === undefined) {
		return undefined;
	}
	if (type === "LOCAL_FILES") {
		return { TYPE: "LOCAL_FILES", PATH: req("TACHI_SEEDS_PATH") };
	}
	if (type === "GIT_REPO") {
		const userName = opt("TACHI_SEEDS_USER_NAME");
		const userEmail = opt("TACHI_SEEDS_USER_EMAIL");
		return {
			TYPE: "GIT_REPO",
			REPO_URL: req("TACHI_SEEDS_REPO_URL"),
			USER_NAME: userName === undefined || userName === "" ? null : userName,
			USER_EMAIL: userEmail === undefined || userEmail === "" ? null : userEmail,
			...(opt("TACHI_SEEDS_BRANCH") !== undefined
				? { BRANCH: opt("TACHI_SEEDS_BRANCH") }
				: {}),
		};
	}
	throw new Error(`Invalid TACHI_SEEDS_TYPE "${type}". Expected LOCAL_FILES or GIT_REPO.`);
}

function envOptFrom(env: NodeJS.ProcessEnv, key: string): string | undefined {
	const v = env[key];
	if (v === undefined || v === "") {
		return undefined;
	}
	return v;
}

function envBoolFrom(env: NodeJS.ProcessEnv, key: string, defaultVal: boolean): boolean {
	const v = envOptFrom(env, key);
	if (v === undefined) {
		return defaultVal;
	}
	if (v === "true" || v === "1") {
		return true;
	}
	if (v === "false" || v === "0") {
		return false;
	}
	return defaultVal;
}

const POSTMARK_SMTP_HOST = "smtp.postmarkapp.com";

/**
 * SMTP settings from env. Required for every deployment.
 *
 * - `TACHI_EMAIL_FROM` - `From` header (must match a verified sender when using Postmark).
 * - `TACHI_EMAIL_HOST`, `TACHI_EMAIL_PORT`, `TACHI_EMAIL_SECURE` (`true` / `false`).
 * - Optionally `TACHI_EMAIL_AUTH_USER` / `TACHI_EMAIL_AUTH_PASS` when the server needs SMTP auth
 *   (Mailpit locally typically needs none).
 * - For Postmark, set host to `smtp.postmarkapp.com` (commonly port `587`, `TACHI_EMAIL_SECURE=false`).
 *   Either auth field may hold the server token; the other is filled with the same value.
 *
 * @internal Exported for unit tests.
 */
export function buildEmailConfig(env: NodeJS.ProcessEnv): TachiServerConfig["EMAIL_CONFIG"] {
	const from = envOptFrom(env, "TACHI_EMAIL_FROM");
	if (from === undefined) {
		throw new Error(`TACHI_EMAIL_FROM is required.`);
	}

	const host = envOptFrom(env, "TACHI_EMAIL_HOST");
	if (host === undefined) {
		throw new Error(`TACHI_EMAIL_HOST is required.`);
	}

	const portRaw = envOptFrom(env, "TACHI_EMAIL_PORT");
	if (portRaw === undefined) {
		throw new Error(`TACHI_EMAIL_PORT is required.`);
	}
	const port = Number.parseInt(portRaw, 10);
	if (Number.isNaN(port)) {
		throw new Error(`TACHI_EMAIL_PORT must be a number, got "${portRaw}".`);
	}

	const secure = envBoolFrom(env, "TACHI_EMAIL_SECURE", false);
	let authUser = envOptFrom(env, "TACHI_EMAIL_AUTH_USER");
	let authPass = envOptFrom(env, "TACHI_EMAIL_AUTH_PASS");

	if (host.toLowerCase() === POSTMARK_SMTP_HOST) {
		const token = authPass ?? authUser;
		if (token === undefined) {
			throw new Error(
				`TACHI_EMAIL_AUTH_PASS or TACHI_EMAIL_AUTH_USER is required when TACHI_EMAIL_HOST is ${POSTMARK_SMTP_HOST}.`,
			);
		}
		authUser = authUser ?? token;
		authPass = authPass ?? token;
	}

	const transportOps: Record<string, unknown> = {
		host,
		port,
		secure,
	};
	if (authUser !== undefined || authPass !== undefined) {
		transportOps.auth = {
			user: authUser ?? "",
			pass: authPass ?? "",
		};
	}

	return {
		FROM: from,
		TRANSPORT_OPS: transportOps,
	};
}

function emailConfig(): TachiServerConfig["EMAIL_CONFIG"] {
	try {
		return buildEmailConfig(process.env);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		log.error({ err, bootInfo: true }, `Invalid email configuration: ${msg}`);
		process.exit(1);
		throw new Error("unreachable");
	}
}

function inviteCodeConfig(): TachiServerConfig["INVITE_CODE_CONFIG"] {
	const batch = opt("TACHI_INVITE_CODE_BATCH_SIZE");
	const cap = opt("TACHI_INVITE_CODE_INVITE_CAP");
	const bonus = opt("TACHI_INVITE_CODE_BETA_USER_BONUS");
	if (batch && cap && bonus) {
		return {
			BATCH_SIZE: Number.parseInt(batch, 10),
			INVITE_CAP: Number.parseInt(cap, 10),
			BETA_USER_BONUS: Number.parseInt(bonus, 10),
		};
	}
	if (!batch && !cap && !bonus) {
		return undefined;
	}
	throw new Error(
		"Incomplete TACHI_INVITE_CODE_*: set BATCH_SIZE, INVITE_CAP, and BETA_USER_BONUS, or none.",
	);
}

function clientDevServer(): string | null | undefined {
	const v = opt("TACHI_CLIENT_DEV_SERVER");
	if (v === undefined) {
		return undefined;
	}
	if (v === "null" || v === "") {
		return null;
	}
	return v;
}

const gameGroups = parseCsv("TACHI_GAME_GROUPS", allSupportedGameGroups as readonly GameGroup[]);
const importTypes = parseCsv("TACHI_IMPORT_TYPES", allImportTypes as readonly ImportTypes[]);

const cgDev = cgOptional("DEV");
const cgNag = cgOptional("NAG");
const cgGan = cgOptional("GAN");
const floOauth = oauth2Optional("FLO");
const eagOauth = oauth2Optional("EAG");
const minOauth = oauth2Optional("MIN");
const emailCfg = emailConfig();
const inviteCfg = inviteCodeConfig();
const bootstrapInvite = opt("TACHI_INVITE_ADMIN_INITIAL_INVITE_CODE")?.trim() || undefined;
const seedsCfg = seedsConfig();
const githubAppCfg = githubAppConfig();
const clientDev = clientDevServer();

const configFromEnv: unknown = {
	CAPTCHA_SECRET_KEY: req("TACHI_CAPTCHA_SECRET_KEY"),
	SESSION_SECRET: req("TACHI_SESSION_SECRET"),
	FLO_API_URL: optUrl("TACHI_FLO_API_URL"),
	EAG_API_URL: optUrl("TACHI_EAG_API_URL"),
	MIN_API_URL: optUrl("TACHI_MIN_API_URL"),
	ARC_API_URL: optUrl("TACHI_ARC_API_URL"),
	MYT_API_HOST: opt("TACHI_MYT_API_HOST"),

	...(cgDev !== undefined ? { CG_DEV_CONFIG: cgDev } : {}),
	...(cgNag !== undefined ? { CG_NAG_CONFIG: cgNag } : {}),
	...(cgGan !== undefined ? { CG_GAN_CONFIG: cgGan } : {}),

	...(floOauth !== undefined ? { FLO_OAUTH2_INFO: floOauth } : {}),
	...(eagOauth !== undefined ? { EAG_OAUTH2_INFO: eagOauth } : {}),
	...(minOauth !== undefined ? { MIN_OAUTH2_INFO: minOauth } : {}),
	ARC_AUTH_TOKEN: opt("TACHI_ARC_AUTH_TOKEN"),
	MYT_AUTH_TOKEN: opt("TACHI_MYT_AUTH_TOKEN"),
	...(clientDev !== undefined ? { CLIENT_DEV_SERVER: clientDev } : {}),
	RATE_LIMIT: parseIntEnv("TACHI_RATE_LIMIT", 500),
	OAUTH_CLIENT_CAP: parseIntEnv("TACHI_OAUTH_CLIENT_CAP", 15),
	OPTIONS_ALWAYS_SUCCEEDS: parseBool("TACHI_OPTIONS_ALWAYS_SUCCEEDS"),
	ALLOW_RUNNING_OFFLINE: parseBool("TACHI_ALLOW_RUNNING_OFFLINE"),
	INLINE_SCORE_IMPORT: parseBool("TACHI_INLINE_SCORE_IMPORT", false) ?? false,
	DISABLE_SCORE_IMPORT_RATE_LIMIT:
		parseBool("TACHI_DISABLE_SCORE_IMPORT_RATE_LIMIT", false) ?? false,
	ENABLE_METRICS: parseBool("TACHI_ENABLE_METRICS", true) ?? true,
	EMAIL_CONFIG: emailCfg,
	USC_QUEUE_SIZE: parseIntEnv("TACHI_USC_QUEUE_SIZE", 3),
	BEATORAJA_QUEUE_SIZE: parseIntEnv("TACHI_BEATORAJA_QUEUE_SIZE", 3),
	MAX_GOAL_SUBSCRIPTIONS: parseIntEnv("TACHI_MAX_GOAL_SUBSCRIPTIONS", 1_000),
	MAX_QUEST_SUBSCRIPTIONS: parseIntEnv("TACHI_MAX_QUEST_SUBSCRIPTIONS", 100),
	MAX_FOLLOWING_AMOUNT: parseIntEnv("TACHI_MAX_FOLLOWING_AMOUNT", 1_000),
	MAX_RIVALS: parseIntEnv("TACHI_MAX_RIVALS", 5),
	OUR_URL: req("TACHI_OUR_URL"),
	...(inviteCfg !== undefined ? { INVITE_CODE_CONFIG: inviteCfg } : {}),
	...(bootstrapInvite !== undefined ? { INVITE_ADMIN_INITIAL_INVITE_CODE: bootstrapInvite } : {}),
	TACHI_CONFIG: {
		NAME: req("TACHI_NAME"),
		TYPE: req("TACHI_TYPE"),
		GAME_GROUPS: gameGroups,
		IMPORT_TYPES: importTypes,
		SIGNUPS_ENABLED: parseBool("TACHI_SIGNUPS_ENABLED", true) ?? true,
		QUEST_PROPOSALS_ENABLED: githubAppCfg !== undefined,
	},
	CDN_CONFIG: {
		WEB_LOCATION: req("TACHI_CDN_WEB_LOCATION"),
		SAVE_LOCATION: s3SaveLocation("TACHI_CDN_SAVE_LOCATION"),
		SAVE_LOCATION_PRIVATE: s3SaveLocation("TACHI_CDN_SAVE_LOCATION_PRIVATE"),
	},
	...(seedsCfg !== undefined ? { SEEDS_CONFIG: seedsCfg } : {}),
	...(githubAppCfg !== undefined ? { GITHUB_APP_CONFIG: githubAppCfg } : {}),
};

const result = configSchema.safeParse(configFromEnv);

if (!result.success) {
	throw new Error(`Invalid server config: ${result.error.message}`);
}

export const TachiConfig = result.data.TACHI_CONFIG;
export const ServerConfig: TachiServerConfig = result.data;

export function AllEnabledGames(): Array<V3Game> {
	return ALL_GAMES.filter((g) => TachiConfig.GAME_GROUPS.includes(GameToGameGroup(g)));
}

// Environment Variable Validation

let PORT = Number(process.env.PORT);

if (Number.isNaN(PORT)) {
	log.warn(`No/invalid PORT specified in environment, defaulting to 8080.`);
	PORT = 8080;
}

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
	log.error(`No REDIS_URL specified in environment. Terminating.`);
	process.exit(1);
}

const NODE_ENV = process.env.NODE_ENV;

if (!NODE_ENV) {
	log.error(`No NODE_ENV specified in environment. Terminating.`);
	process.exit(1);
}

if (!["dev", "production", "staging", "test"].includes(NODE_ENV)) {
	log.error(
		`Invalid NODE_ENV set in environment. Expected dev, production, test or staging. Got ${NODE_ENV}.`,
	);
	process.exit(1);
}

if (TachiConfig.GAME_GROUPS.includes("bms") !== TachiConfig.GAME_GROUPS.includes("pms")) {
	log.error(`BMS and PMS MUST be enabled at the same time, due to how the beatoraja IR works.`);

	process.exit(1);
}

const logLevel = process.env.LOG_LEVEL ?? "info";

if (!["crit", "debug", "error", "info", "severe", "verbose", "warn"].includes(logLevel)) {
	log.error(`Invalid LOG_LEVEL of ${logLevel}.`);

	process.exit(1);
}

const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
	log.error(`No POSTGRES_URL specified in environment. Terminating.`);
	process.exit(1);
}

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR;

if (!MIGRATIONS_DIR) {
	log.error(`No MIGRATIONS_DIR specified in environment. Terminating.`);
	process.exit(1);
}

let version = process.env.VERSION;

if (!version) {
	log.warn(`No VERSION specified in environment. defaulting to 0.0.0.`);
	version = "0.0.0";
}

/** Human-readable build identity: `{commit date UTC YYYYMMDD}-{short sha}`, e.g. `20260516-a1b2c3d`. */
let versionDetail = process.env.VERSION_DETAIL?.trim();

if (!versionDetail) {
	const legacy = process.env.COMMIT_HASH?.trim();
	if (legacy) {
		versionDetail = legacy;
	}
}

if (!versionDetail) {
	log.warn(
		`No VERSION_DETAIL (or COMMIT_HASH) specified in environment. defaulting detail to unknown.`,
	);
	versionDetail = "unknown";
}

/**
 * Maximum number of connections in the Postgres pool for this process.
 * For job-queue workers, set this to at least `TACHI_JOB_QUEUE_WORKER_POOL + 2`
 * so every worker loop can hold a connection simultaneously without queuing.
 */
const PG_POOL_MAX = parseIntEnv("PG_POOL_MAX", 10);

/**
 * Cost factor for `bcrypt.hash` (and the round-trip cost of `bcrypt.compare`
 * against any resulting hash). Defaults to 12 - the value the codebase shipped
 * with - and is enforced as a minimum outside test environments.
 *
 * In tests we want bcrypt to be effectively free: the test suite hashes /
 * verifies dozens of passwords and at 12 rounds bcrypt dominates the auth-
 * flavoured test budget. Set via TACHI_BCRYPT_SALT_ROUNDS (defaults to the
 * bcryptjs minimum, 4, when NODE_ENV=test).
 */
const BCRYPT_SALT_ROUNDS = parseIntEnv("TACHI_BCRYPT_SALT_ROUNDS", NODE_ENV === "test" ? 4 : 12);

if (NODE_ENV !== "test" && BCRYPT_SALT_ROUNDS < 12) {
	log.fatal(
		`TACHI_BCRYPT_SALT_ROUNDS=${BCRYPT_SALT_ROUNDS} but NODE_ENV=${NODE_ENV}. ` +
			`Refusing to start: rounds below 12 are only acceptable in test environments.`,
	);
	process.exit(1);
}

export const Env = {
	PORT,
	REDIS_URL,
	POSTGRES_URL,
	MIGRATIONS_DIR,
	VERSION: version,
	VERSION_DETAIL: versionDetail,
	NODE_ENV: NODE_ENV as "dev" | "production" | "staging" | "test",
	LOG_LEVEL: logLevel as "crit" | "debug" | "error" | "info" | "severe" | "verbose" | "warn",
	PG_POOL_MAX,
	BCRYPT_SALT_ROUNDS,
};
