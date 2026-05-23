import type { Readable } from "node:stream";

import { log } from "#lib/log/log";
import { ServerConfig } from "#lib/setup/config";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { buffer as streamToBuffer } from "node:stream/consumers";

const saveLoc = ServerConfig.CDN_CONFIG.SAVE_LOCATION;
const saveLocPrivate = ServerConfig.CDN_CONFIG.SAVE_LOCATION_PRIVATE;

log.info({ bootInfo: true }, `Using S3 bucket as CDN location: ${saveLoc.BUCKET}.`);
log.info({ bootInfo: true }, `Using S3 bucket as private CDN location: ${saveLocPrivate.BUCKET}.`);

const S3_PUBLIC = new S3Client({
	endpoint: saveLoc.ENDPOINT,
	region: saveLoc.REGION ?? "us-east-1",
	credentials: {
		accessKeyId: saveLoc.ACCESS_KEY_ID,
		secretAccessKey: saveLoc.SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

const S3_PRIVATE = new S3Client({
	endpoint: saveLocPrivate.ENDPOINT,
	region: saveLocPrivate.REGION ?? "us-east-1",
	credentials: {
		accessKeyId: saveLocPrivate.ACCESS_KEY_ID,
		secretAccessKey: saveLocPrivate.SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

/** Object key as stored in the bucket (includes optional KEY_PREFIX). */
export function cdnObjectKey(fileLoc: string): string {
	return (saveLoc.KEY_PREFIX ?? "") + fileLoc;
}

/** Object key in the private bucket (includes optional KEY_PREFIX). */
export function cdnObjectKey_PRIVATE(fileLoc: string): string {
	return (saveLocPrivate.KEY_PREFIX ?? "") + fileLoc;
}

export interface S3ObjectMeta {
	cacheControl?: string;
	contentType?: string;
}

/**
 * Pushes a file to the configured S3 Bucket. Overwrites if already exists.
 */
export function PushToS3_PUBLIC(path: string, content: string | Buffer, meta?: S3ObjectMeta) {
	if (path.startsWith("/")) {
		throw new Error(
			`no. absolutely not. Trying to do s3 push with a prefix /. this causes all sorts of trouble: ${path}`,
		);
	}
	log.debug(`Saving content on S3 at ${path}.`);

	return S3_PUBLIC.send(
		new PutObjectCommand({
			Bucket: saveLoc.BUCKET,
			Key: cdnObjectKey(path),
			Body: content,
			CacheControl: meta?.cacheControl,
			ContentType: meta?.contentType,
		}),
	);
}

/**
 * Pushes a file to the configured private S3 bucket. Overwrites if already exists.
 */
export function PushToS3_PRIVATE(path: string, content: string | Buffer) {
	if (path.startsWith("/")) {
		throw new Error(
			`no. absolutely not. Trying to do s3 push with a prefix /. this causes all sorts of trouble: ${path}`,
		);
	}
	log.debug(`Saving content on private S3 at ${path}.`);

	return S3_PRIVATE.send(
		new PutObjectCommand({
			Bucket: saveLocPrivate.BUCKET,
			Key: cdnObjectKey_PRIVATE(path),
			Body: content,
		}),
	);
}

/**
 * Reads a file from the configured S3 bucket.
 */
export async function GetObjectFromS3_PUBLIC(path: string): Promise<Buffer> {
	if (path.startsWith("/")) {
		throw new Error(
			`no. absolutely not. Trying to do s3 get with a prefix /. this causes all sorts of trouble: ${path}`,
		);
	}
	const response = await S3_PUBLIC.send(
		new GetObjectCommand({
			Bucket: saveLoc.BUCKET,
			Key: cdnObjectKey(path),
		}),
	);

	if (!response.Body) {
		throw new Error(`S3 GetObject returned no body for ${path}.`);
	}

	return streamToBuffer(response.Body as Readable);
}

/**
 * Reads a file from the configured private S3 bucket.
 */
export async function GetObjectFromS3_PRIVATE(path: string): Promise<Buffer> {
	if (path.startsWith("/")) {
		throw new Error(
			`no. absolutely not. Trying to do s3 get with a prefix /. this causes all sorts of trouble: ${path}`,
		);
	}
	const response = await S3_PRIVATE.send(
		new GetObjectCommand({
			Bucket: saveLocPrivate.BUCKET,
			Key: cdnObjectKey_PRIVATE(path),
		}),
	);

	if (!response.Body) {
		throw new Error(`S3 GetObject (private) returned no body for ${path}.`);
	}

	return streamToBuffer(response.Body as Readable);
}

/**
 * Deletes the provided file from the configured S3 bucket.
 */
export function DeleteFromS3_PUBLIC(path: string) {
	return S3_PUBLIC.send(
		new DeleteObjectCommand({
			Bucket: saveLoc.BUCKET,
			Key: cdnObjectKey(path),
		}),
	);
}

/**
 * Deletes the provided file from the configured private S3 bucket.
 */
export function DeleteFromS3_PRIVATE(path: string) {
	return S3_PRIVATE.send(
		new DeleteObjectCommand({
			Bucket: saveLocPrivate.BUCKET,
			Key: cdnObjectKey_PRIVATE(path),
		}),
	);
}
