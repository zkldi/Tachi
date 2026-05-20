import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup, integer } from "tachi-common";

import { drainMytPlaylogStream } from "#lib/score-import/import-types/common/api-myt/buffer-playlog-stream";
import {
	CreateMytTransport,
	FetchMytTitleAPIID,
} from "#lib/score-import/import-types/common/api-myt/traverse-api";
import { GetPlaylogRequestSchema, OngekiUser } from "#proto/generated/ongeki/user_pb";
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";

import type { MytOngekiScore } from "./types";

async function* streamPlaylog(userID: integer, log: KtLogger): AsyncIterable<MytOngekiScore> {
	const profileApiId = await FetchMytTitleAPIID(userID, "ongeki", log);
	const client = createClient(OngekiUser, CreateMytTransport());
	const request = create(GetPlaylogRequestSchema, { profileApiId });

	yield* await drainMytPlaylogStream(client.getPlaylog(request), log, {
		gameLabel: "Ongeki",
		userID,
	});
}

export default async function ParseMytOngeki(
	userID: integer,
	log: KtLogger,
): Promise<ParserFunctionReturns<MytOngekiScore, EmptyObject, GamesForGroup["ongeki"]>> {
	return {
		service: "MYT",
		iterable: streamPlaylog(userID, log),
		context: {},
		classProvider: null,
		gameGroup: "ongeki",
	};
}
