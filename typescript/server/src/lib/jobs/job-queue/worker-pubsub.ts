import { log } from "#lib/log/log";
import { TachiConfig } from "#lib/setup/config";
import { RedisClient } from "#services/redis/redis";

const PREFIX = TachiConfig.NAME;

/** Per-import Redis pub/sub channel name. */
export function importProgressChannel(importID: string): string {
	return `${PREFIX}:import-progress:${importID}`;
}

export type ImportProgressEvent =
	| { description: string; type: "import:failed" }
	| { description: string; type: "progress" }
	| { type: "done" };

/**
 * Publish a progress event on the per-import channel. Fire-and-forget.
 */
export function PublishImportProgressEvent(importID: string, event: ImportProgressEvent): void {
	RedisClient.publish(importProgressChannel(importID), JSON.stringify(event)).catch(
		(err: unknown) => {
			log.warn({ err, importID, event }, "Failed to publish import progress event to Redis.");
		},
	);
}
