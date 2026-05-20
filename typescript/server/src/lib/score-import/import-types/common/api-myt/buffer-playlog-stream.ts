import type { KtLogger } from "#lib/log/log";
import type { integer } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ConnectError } from "@connectrpc/connect";

export type MytPlaylogStreamContext = {
	gameLabel: string;
	userID?: integer;
};

/**
 * Drain a MYT server-streaming GetPlaylog RPC before score import processes rows.
 *
 * Bun's HTTP/2 client closes the stream with "Premature close" if we yield each
 * item and then do slow DB work before reading the next message. Draining first
 * matches Node behaviour and the fast path of the myt-grpc-probe.
 */
export async function drainMytPlaylogStream<T>(
	stream: AsyncIterable<T>,
	log: KtLogger,
	context: MytPlaylogStreamContext,
): Promise<T[]> {
	const items: T[] = [];

	try {
		for await (const item of stream) {
			items.push(item);
		}
	} catch (err) {
		const userSuffix = context.userID !== undefined ? ` for userID ${context.userID}` : "";

		if (err instanceof ConnectError) {
			log.error(
				{ err, code: err.code },
				`MYT gRPC error streaming ${context.gameLabel} playlog${userSuffix}`,
			);
		} else {
			log.error(
				{ err },
				`Unexpected MYT error streaming ${context.gameLabel} playlog${userSuffix}`,
			);
		}

		throw new ScoreImportFatalError(500, `Failed to get scores from MYT.`);
	}

	const userSuffix = context.userID !== undefined ? ` for userID ${context.userID}` : "";
	log.debug(`Buffered ${items.length} MYT ${context.gameLabel} playlog row(s)${userSuffix}`);

	return items;
}
