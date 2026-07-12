import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup, integer } from "tachi-common";

import { GetImportTimestop } from "#lib/score-import/framework/common/timestop";
import { drainMytPlaylogStream } from "#lib/score-import/import-types/common/api-myt/buffer-playlog-stream";
import {
	CreateMytTransport,
	FetchMytTitleAPIID,
} from "#lib/score-import/import-types/common/api-myt/traverse-api";
import { ChunithmUser, GetPlaylogRequestSchema } from "#proto/generated/chunithm/user_pb";
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";

import type { MytChunithmScore } from "./types";

async function* streamPlaylog(userID: integer, log: KtLogger): AsyncIterable<MytChunithmScore> {
	const [profileApiId, lastScoreTime] = await Promise.all([
		FetchMytTitleAPIID(userID, "chunithm", log),
		GetImportTimestop(userID, "api/myt-chunithm"),
	]);

	const client = createClient(ChunithmUser, CreateMytTransport());
	const request = create(GetPlaylogRequestSchema, {
		profileApiId,
		lastUserPlayDate: lastScoreTime?.toISOString() ?? undefined,
	});

	yield* await drainMytPlaylogStream(client.getPlaylog(request), log, {
		gameLabel: "Chunithm",
		userID,
	});
}

export default function ParseMytChunithm(
	userID: integer,
	log: KtLogger,
): Promise<ParserFunctionReturns<MytChunithmScore, EmptyObject, GamesForGroup["chunithm"]>> {
	return Promise.resolve({
		service: "MYT",
		iterable: streamPlaylog(userID, log),
		context: {},
		classProvider: null,
		gameGroup: "chunithm",
	});
}
