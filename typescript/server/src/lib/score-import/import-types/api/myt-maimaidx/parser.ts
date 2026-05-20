import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup, integer } from "tachi-common";

import { drainMytPlaylogStream } from "#lib/score-import/import-types/common/api-myt/buffer-playlog-stream";
import {
	CreateMytTransport,
	FetchMytTitleAPIID,
} from "#lib/score-import/import-types/common/api-myt/traverse-api";
import { GetPlaylogRequestSchema, MaimaiUser } from "#proto/generated/maimai/user_pb";
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";

import type { MytMaimaiDxScore } from "./types";

async function* streamPlaylog(userID: integer, log: KtLogger): AsyncIterable<MytMaimaiDxScore> {
	const profileApiId = await FetchMytTitleAPIID(userID, "maimaidx", log);
	const client = createClient(MaimaiUser, CreateMytTransport());
	const request = create(GetPlaylogRequestSchema, { profileApiId });

	yield* await drainMytPlaylogStream(client.getPlaylog(request), log, {
		gameLabel: "maimai DX",
		userID,
	});
}

export default async function ParseMytMaimaiDx(
	userID: integer,
	log: KtLogger,
): Promise<ParserFunctionReturns<MytMaimaiDxScore, EmptyObject, GamesForGroup["maimaidx"]>> {
	return {
		service: "MYT",
		iterable: streamPlaylog(userID, log),
		context: {},
		classProvider: null,
		gameGroup: "maimaidx",
	};
}
