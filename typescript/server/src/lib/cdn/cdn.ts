import type { Response } from "express";

import { log } from "#lib/log/log";
import { ServerConfig } from "#lib/setup/config";

import {
	DeleteFromS3_PUBLIC,
	GetObjectFromS3_PUBLIC,
	PushToS3_PUBLIC,
	type S3ObjectMeta,
} from "./s3";

/**
 * Retrieves the bytes at the given CDN location from S3.
 */
export function CDNRetrieve(fileLoc: string) {
	log.debug(`Retrieving path ${fileLoc} from S3.`);

	return GetObjectFromS3_PUBLIC(fileLoc.replace(/^\//u, ""));
}

/**
 * Redirects the response to the CDN server at the given path.
 */
export function CDNRedirect(res: Response, fileLoc: string) {
	if (!fileLoc.startsWith("/")) {
		throw new Error(`Invalid fileLoc - did not start with /.`);
	}

	log.debug(`CDN Redirecting to ${ServerConfig.CDN_CONFIG.WEB_LOCATION}${fileLoc}.`);

	res.redirect(`${ServerConfig.CDN_CONFIG.WEB_LOCATION}${fileLoc}`);
}

/**
 * Stores a file at fileLoc. If it already exists, overwrite it.
 */
export async function CDNStoreOrOverwrite(fileLoc: string, data: string | Buffer): Promise<void> {
	log.debug(`Storing or overwriting path ${fileLoc}.`);

	await PushToS3_PUBLIC(fileLoc.replace(/^\//u, ""), data);
}

/**
 * Stores a file at fileLoc with explicit S3 object metadata (ContentType, CacheControl).
 * If it already exists, overwrite it.
 */
export async function CDNStoreWithMeta(
	fileLoc: string,
	data: string | Buffer,
	meta: S3ObjectMeta,
): Promise<void> {
	log.debug(`Storing or overwriting path ${fileLoc} with metadata.`);

	await PushToS3_PUBLIC(fileLoc.replace(/^\//u, ""), data, meta);
}

/**
 * Removes a file at this CDN location.
 */
export async function CDNDelete(fileLoc: string) {
	log.debug(`Deleting path ${fileLoc}.`);

	await DeleteFromS3_PUBLIC(fileLoc.replace(/^\//u, ""));
}
