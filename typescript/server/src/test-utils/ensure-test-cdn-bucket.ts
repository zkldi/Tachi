import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutBucketPolicyCommand,
	S3Client,
} from "@aws-sdk/client-s3";

import { loadServerEnvFile } from "../lib/setup/load-server-env";

/** MinIO buckets for dev/CI (matches docker-compose / bootstrap). */
const MINIO_BUCKETS = ["tachi-public", "tachi-private", "tachi-backups"] as const;

function anonymousGetObjectPolicy(bucket: string): string {
	return JSON.stringify({
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Principal: { AWS: ["*"] },
				Action: ["s3:GetObject"],
				Resource: [`arn:aws:s3:::${bucket}/*`],
			},
		],
	});
}

/**
 * Ensures MinIO buckets exist and tachi-public allows anonymous reads for seeded CDN assets (CI + local test runs).
 */
export async function ensureTestCdnBucket() {
	loadServerEnvFile(".env.test");

	const endpoint = process.env.TACHI_CDN_SAVE_LOCATION_ENDPOINT;
	const accessKeyId = process.env.TACHI_CDN_SAVE_LOCATION_ACCESS_KEY_ID;
	const secretAccessKey = process.env.TACHI_CDN_SAVE_LOCATION_SECRET_ACCESS_KEY;
	const bucket = process.env.TACHI_CDN_SAVE_LOCATION_BUCKET;
	const region = process.env.TACHI_CDN_SAVE_LOCATION_REGION;

	if (
		endpoint === undefined ||
		accessKeyId === undefined ||
		secretAccessKey === undefined ||
		bucket === undefined
	) {
		throw new Error(
			"Missing TACHI_CDN_SAVE_LOCATION_* env vars (see .env.test). Required: ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET.",
		);
	}

	if (bucket !== "tachi-public") {
		throw new Error(`TACHI_CDN_SAVE_LOCATION_BUCKET must be "tachi-public"; got "${bucket}".`);
	}

	const client = new S3Client({
		endpoint,
		region: region ?? "us-east-1",
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
		forcePathStyle: true,
	});

	async function ensureBucketExists(bucketName: string): Promise<void> {
		/* eslint-disable no-await-in-loop -- retry Head/Create until MinIO accepts connections */
		for (let attempt = 0; attempt < 60; attempt++) {
			try {
				await client.send(new HeadBucketCommand({ Bucket: bucketName }));
				return;
			} catch {
				// bucket missing or service not ready
			}

			try {
				await client.send(new CreateBucketCommand({ Bucket: bucketName }));
				return;
			} catch {
				await new Promise((r) => setTimeout(r, 1000));
			}
		}
		/* eslint-enable no-await-in-loop */

		throw new Error(
			`Could not reach or create S3 bucket "${bucketName}" at ${endpoint}. Is MinIO running?`,
		);
	}

	/* eslint-disable no-await-in-loop -- sequential bucket setup */
	for (const b of MINIO_BUCKETS) {
		await ensureBucketExists(b);
	}
	/* eslint-enable no-await-in-loop */

	await client.send(
		new PutBucketPolicyCommand({
			Bucket: "tachi-public",
			Policy: anonymousGetObjectPolicy("tachi-public"),
		}),
	);
}
