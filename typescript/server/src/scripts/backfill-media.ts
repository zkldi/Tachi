/**
 * backfill-media.ts
 *
 * One-off script to resize and add cache metadata to all existing profile
 * pictures and banners in S3. Reads each user's current object, runs it
 * through the same resize/WebP pipeline introduced by the profile image
 * optimisation, stores the result under a new content-addressed key (with
 * immutable cache headers), and updates the DB row.
 *
 * Old S3 objects are NOT deleted - they remain as orphans in the bucket.
 * Remove them separately once you are satisfied the migration is complete,
 * for example with:
 *   aws s3 rm --recursive s3://BUCKET/users/ --exclude pfp --dryrun
 *
 * The script is safe to re-run: if the existing object is already a small
 * WebP its hash will be unchanged after reprocessing and the DB update is
 * skipped.
 *
 * Usage:
 *   bun run src/scripts/backfill-media.ts \
 *     --pg-url  postgresql://tachi:tachi@localhost/tachi \
 *     --endpoint http://localhost:9000 \
 *     --access-key-id KEY \
 *     --secret-access-key SECRET \
 *     --bucket tachi-public \
 *     [--region us-east-1] \
 *     [--key-prefix some/prefix/] \
 *     [--dry-run]
 *
 * Alternatively, the S3 flags are read from the matching
 * TACHI_CDN_SAVE_LOCATION_* environment variables when not supplied on the
 * command line.
 */

import type { Readable } from "node:stream";
import type { Database } from "tachi-db";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Kysely, PostgresDialect } from "kysely";
import crypto from "node:crypto";
import { buffer as streamToBuffer } from "node:stream/consumers";
import { parseArgs } from "node:util";
import pg from "pg";
import sharp from "sharp";

// ─── Constants (must match change-pfp.ts / change-banner.ts) ─────────────────

const PFP_MAX_PX = 256;
const BANNER_MAX_WIDTH = 1920;
const BANNER_MAX_HEIGHT = 1080;
const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";

// ─── CLI args ─────────────────────────────────────────────────────────────────

function printHelp(): void {
	console.log(`
backfill-media — resize and cache-header all existing profile pictures/banners

  --pg-url <url>            Postgres connection string  [TACHI_PG_URL]
  --endpoint <url>          S3 endpoint                 [TACHI_CDN_SAVE_LOCATION_ENDPOINT]
  --access-key-id <key>     S3 access key ID            [TACHI_CDN_SAVE_LOCATION_ACCESS_KEY_ID]
  --secret-access-key <s>   S3 secret access key        [TACHI_CDN_SAVE_LOCATION_SECRET_ACCESS_KEY]
  --bucket <name>           S3 bucket name              [TACHI_CDN_SAVE_LOCATION_BUCKET]
  --region <region>         S3 region (default: us-east-1) [TACHI_CDN_SAVE_LOCATION_REGION]
  --key-prefix <prefix>     Key prefix in the bucket    [TACHI_CDN_SAVE_LOCATION_KEY_PREFIX]
  --dry-run                 Log what would change without writing anything
  -h, --help                Show this help
`);
}

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		"pg-url": { type: "string" },
		endpoint: { type: "string" },
		"access-key-id": { type: "string" },
		"secret-access-key": { type: "string" },
		bucket: { type: "string" },
		region: { type: "string" },
		"key-prefix": { type: "string" },
		"dry-run": { type: "boolean" },
		help: { type: "boolean", short: "h" },
	},
});

if (values.help) {
	printHelp();
	process.exit(0);
}

function envOr(cliValue: string | undefined, envVar: string): string | undefined {
	return cliValue ?? process.env[envVar];
}

function requireArg(value: string | undefined, name: string, envVar: string): string {
	if (!value) {
		console.error(`backfill-media: --${name} (or ${envVar}) is required.`);
		printHelp();
		process.exit(1);
	}
	return value;
}

const pgUrl = requireArg(envOr(values["pg-url"], "TACHI_PG_URL"), "pg-url", "TACHI_PG_URL");

const s3Endpoint = requireArg(
	envOr(values.endpoint, "TACHI_CDN_SAVE_LOCATION_ENDPOINT"),
	"endpoint",
	"TACHI_CDN_SAVE_LOCATION_ENDPOINT",
);

const s3AccessKeyId = requireArg(
	envOr(values["access-key-id"], "TACHI_CDN_SAVE_LOCATION_ACCESS_KEY_ID"),
	"access-key-id",
	"TACHI_CDN_SAVE_LOCATION_ACCESS_KEY_ID",
);

const s3SecretAccessKey = requireArg(
	envOr(values["secret-access-key"], "TACHI_CDN_SAVE_LOCATION_SECRET_ACCESS_KEY"),
	"secret-access-key",
	"TACHI_CDN_SAVE_LOCATION_SECRET_ACCESS_KEY",
);

const s3Bucket = requireArg(
	envOr(values.bucket, "TACHI_CDN_SAVE_LOCATION_BUCKET"),
	"bucket",
	"TACHI_CDN_SAVE_LOCATION_BUCKET",
);

const s3Region = envOr(values.region, "TACHI_CDN_SAVE_LOCATION_REGION") ?? "us-east-1";
const keyPrefix = envOr(values["key-prefix"], "TACHI_CDN_SAVE_LOCATION_KEY_PREFIX") ?? "";
const isDryRun = values["dry-run"] ?? false;

if (isDryRun) {
	console.log("[backfill-media] DRY RUN — no changes will be written.");
}

// ─── S3 + DB clients ──────────────────────────────────────────────────────────

const s3 = new S3Client({
	endpoint: s3Endpoint,
	region: s3Region,
	credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
	forcePathStyle: true,
});

const pool = new pg.Pool({ connectionString: pgUrl });
const DB = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s3Key(cdnPath: string): string {
	// cdnPath is always /users/... — strip leading slash then prepend prefix.
	return `${keyPrefix}${cdnPath.replace(/^\//u, "")}`;
}

function hashBuffer(buf: Buffer): string {
	return crypto.createHash("sha256").update(buf).digest("hex");
}

async function downloadFromS3(cdnPath: string): Promise<Buffer | null> {
	try {
		const response = await s3.send(
			new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key(cdnPath) }),
		);

		if (!response.Body) {
			return null;
		}

		return streamToBuffer(response.Body as Readable);
	} catch (err: unknown) {
		// Object missing from S3 — the DB row is a dangling reference.
		if (
			err instanceof Error &&
			(err.name === "NoSuchKey" || err.message.includes("NoSuchKey"))
		) {
			return null;
		}
		throw err;
	}
}

async function uploadToS3(cdnPath: string, body: Buffer, contentType: string): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket: s3Bucket,
			Key: s3Key(cdnPath),
			Body: body,
			ContentType: contentType,
			CacheControl: CACHE_CONTROL_IMMUTABLE,
		}),
	);
}

async function resizePfp(buf: Buffer): Promise<Buffer> {
	return sharp(buf, { animated: true })
		.resize(PFP_MAX_PX, PFP_MAX_PX, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
}

async function resizeBanner(buf: Buffer): Promise<Buffer> {
	return sharp(buf, { animated: true })
		.resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
}

// ─── Core migration logic ─────────────────────────────────────────────────────

interface Stats {
	processed: number;
	skipped: number;
	missing: number;
	errors: number;
}

async function migrateMedia(
	userId: number,
	username: string,
	currentHash: string,
	cdnPathFn: (id: number, hash: string) => string,
	resizeFn: (buf: Buffer) => Promise<Buffer>,
	dbColumn: "custom_banner_location" | "custom_pfp_location",
	label: string,
	stats: Stats,
): Promise<void> {
	const currentCdnPath = cdnPathFn(userId, currentHash);
	const logPrefix = `  [${username}/${label}]`;

	const original = await downloadFromS3(currentCdnPath);

	if (!original) {
		console.warn(`${logPrefix} S3 object missing — skipping (dangling DB reference).`);
		stats.missing++;
		return;
	}

	let resized: Buffer;

	try {
		resized = await resizeFn(original);
	} catch (err: unknown) {
		console.error(`${logPrefix} sharp failed to process — skipping.`, err);
		stats.errors++;
		return;
	}

	const newHash = hashBuffer(resized);

	if (newHash === currentHash) {
		console.log(`${logPrefix} already optimal (hash unchanged) — skipping.`);
		stats.skipped++;
		return;
	}

	const newCdnPath = cdnPathFn(userId, newHash);
	const sizeBefore = original.length;
	const sizeAfter = resized.length;
	const pct = Math.round((1 - sizeAfter / sizeBefore) * 100);

	console.log(
		`${logPrefix} ${(sizeBefore / 1024).toFixed(1)} KB → ${(sizeAfter / 1024).toFixed(1)} KB (${pct}% smaller, image/webp)`,
	);

	if (!isDryRun) {
		await uploadToS3(newCdnPath, resized, "image/webp");

		await DB.updateTable("account")
			.set({ [dbColumn]: newHash })
			.where("id", "=", userId)
			.execute();
	}

	stats.processed++;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	console.log(`[backfill-media] Connected to ${pgUrl}.`);
	console.log(`[backfill-media] S3 endpoint: ${s3Endpoint}, bucket: ${s3Bucket}`);

	const users = await DB.selectFrom("account")
		.select(["id", "username", "custom_pfp_location", "custom_banner_location"])
		.where((eb) =>
			eb.or([
				eb("custom_pfp_location", "is not", null),
				eb("custom_banner_location", "is not", null),
			]),
		)
		.orderBy("id", "asc")
		.execute();

	console.log(
		`[backfill-media] Found ${users.length} users with at least one custom media object.`,
	);

	const pfpStats: Stats = { processed: 0, skipped: 0, missing: 0, errors: 0 };
	const bannerStats: Stats = { processed: 0, skipped: 0, missing: 0, errors: 0 };

	for (const user of users) {
		if (user.custom_pfp_location) {
			await migrateMedia(
				user.id,
				user.username,
				user.custom_pfp_location,
				(id, hash) => `/users/${id}/pfp-${hash}`,
				resizePfp,
				"custom_pfp_location",
				"pfp",
				pfpStats,
			);
		}

		if (user.custom_banner_location) {
			await migrateMedia(
				user.id,
				user.username,
				user.custom_banner_location,
				(id, hash) => `/users/${id}/banner-${hash}`,
				resizeBanner,
				"custom_banner_location",
				"banner",
				bannerStats,
			);
		}
	}

	console.log(`
[backfill-media] Done.

  Profile pictures
    Resized and re-uploaded : ${pfpStats.processed}
    Already optimal (skip)  : ${pfpStats.skipped}
    Missing from S3         : ${pfpStats.missing}
    Errors                  : ${pfpStats.errors}

  Banners
    Resized and re-uploaded : ${bannerStats.processed}
    Already optimal (skip)  : ${bannerStats.skipped}
    Missing from S3         : ${bannerStats.missing}
    Errors                  : ${bannerStats.errors}
`);

	if (!isDryRun && pfpStats.errors + bannerStats.errors > 0) {
		console.warn(
			"[backfill-media] Some objects failed to process. Re-run the script to retry them.",
		);
	}

	await pool.end();
}

await main().catch((err: unknown) => {
	console.error("[backfill-media] Fatal error:", err);
	process.exit(1);
});
