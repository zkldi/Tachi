import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup, integer } from "tachi-common";

import { GetImportTimestop } from "#lib/score-import/framework/common/timestop";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { drainMytPlaylogStream } from "#lib/score-import/import-types/common/api-myt/buffer-playlog-stream";
import {
	CreateMytTransport,
	FetchMytTitleAPIID,
} from "#lib/score-import/import-types/common/api-myt/traverse-api";
import { PlaylogRequestSchema, WaccaUser } from "#proto/generated/wacca/user_pb";
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";

import type { MytWaccaScore } from "./types";

import CreateMytWACCAClassHandler from "./class-handler";

async function* streamPlaylog(
	apiId: string,
	log: KtLogger,
	userID: integer,
	lastScoreTime: Date | null,
): AsyncIterable<MytWaccaScore> {
	const client = createClient(WaccaUser, CreateMytTransport());
	const request = create(PlaylogRequestSchema, { apiId });

	const items = await drainMytPlaylogStream(client.getPlaylog(request), log, {
		gameLabel: "WACCA",
		userID,
	});

	const cutoff = lastScoreTime?.getTime() ?? null;

	for (const item of items) {
		if (!item.info) {
			log.warn(`Received WACCA playlog stream item with no info - skipping.`);
			continue;
		}

		if (cutoff !== null) {
			const parsed = Date.parse(item.info.userPlayDate);

			if (!Number.isNaN(parsed) && parsed <= cutoff) {
				continue;
			}
		}

		yield item.info;
	}
}

export default async function ParseMytWACCA(
	userID: integer,
	log: KtLogger,
): Promise<ParserFunctionReturns<MytWaccaScore, EmptyObject, GamesForGroup["wacca"]>> {
	const [titleApiId, lastScoreTime] = await Promise.all([
		FetchMytTitleAPIID(userID, "wacca", log),
		GetImportTimestop(userID, "api/myt-wacca"),
	]);

	let classProvider;

	try {
		classProvider = await CreateMytWACCAClassHandler(titleApiId, CreateMytTransport());
	} catch (err) {
		log.error(`Unexpected MYT error while fetching player data for userID ${userID}: ${err}`);
		throw new ScoreImportFatalError(500, `Failed to fetch player data from MYT.`);
	}

	return {
		service: "MYT",
		iterable: streamPlaylog(titleApiId, log, userID, lastScoreTime),
		context: {},
		classProvider,
		gameGroup: "wacca",
	};
}
