import type { KtLogger } from "#lib/log/log";

import { SELECT_MYT_CARD_INFO, ToMytCardInfo } from "#lib/db-formats/myt-card-info";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ServerConfig } from "#lib/setup/config";
import { Cards, LookupRequestSchema } from "#proto/generated/cards/cards_pb";
import DB from "#services/pg/db";
import { create } from "@bufbuild/protobuf";
import {
	Code as ConnectCode,
	ConnectError,
	createClient,
	type Interceptor,
} from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { type GameGroup, GetGameGroupConfig, type integer } from "tachi-common";

import { GameToMytGame } from "./util";

// Hardcode all requests to time out after 10 minutes.
const GRPC_TIMEOUT_MS = 10 * 60 * 1000;

export function GetMytHostname(): string {
	const hostname = ServerConfig.MYT_API_HOST;

	if (hostname === undefined) {
		throw new ScoreImportFatalError(
			500,
			`Tried to get MYT API server host, yet was not defined?`,
		);
	}

	return hostname;
}

function createBearerInterceptor(): Interceptor {
	const authToken = ServerConfig.MYT_AUTH_TOKEN;

	if (authToken === undefined) {
		throw new ScoreImportFatalError(500, `Tried to get MYT auth token, yet was not defined?`);
	}

	return (next) => async (req) => {
		req.header.set("Authorization", `Bearer ${authToken}`);
		return next(req);
	};
}

export function CreateMytTransport() {
	return createGrpcTransport({
		baseUrl: `https://${GetMytHostname()}`,
		interceptors: [createBearerInterceptor()],
		defaultTimeoutMs: GRPC_TIMEOUT_MS,
	});
}

/**
 * The Myt API is (currently) based on card access codes, which you can use to
 * get a "title_api_id" (see proto/cards/cards.proto).
 * The title_api_id uniquely identifies a player and a game ("title"). As such,
 * the first step for syncing any game for a player is to use their card access
 * code to fetch the title_api_id corresponding to the game.
 */
export async function FetchMytTitleAPIID(
	userID: integer,
	game: GameGroup,
	log: KtLogger,
): Promise<string> {
	const mytGame = GameToMytGame(game);

	if (mytGame === undefined) {
		throw new ScoreImportFatalError(500, `Unsupported game ${game}`);
	}

	const row = await DB.selectFrom("priv_svc_myt_card_info")
		.select(SELECT_MYT_CARD_INFO)
		.where("user_id", "=", userID)
		.executeTakeFirst();

	if (!row) {
		throw new ScoreImportFatalError(401, `This user has no card info set up for this service.`);
	}

	const { cardAccessCode } = ToMytCardInfo(row);
	const client = createClient(Cards, CreateMytTransport());
	const req = create(LookupRequestSchema, {
		accessCode: cardAccessCode,
		titles: [mytGame],
	});

	try {
		const response = await client.lookup(req);

		for (const title of response.titles) {
			if (title.titleKind === mytGame) {
				return title.titleApiId;
			}
		}
	} catch (e) {
		if (e instanceof ConnectError) {
			if (e.code === ConnectCode.NotFound) {
				throw new ScoreImportFatalError(401, `Card not found on MYT: ${e.message}`);
			}

			log.error({ err: e, code: e.code }, `Received unexpected status from MYT`);
			throw new ScoreImportFatalError(500, `Unexpected response from MYT - ${e.code}`);
		}

		log.error({ err: e }, `Received invalid response`);
		throw new ScoreImportFatalError(500, `Failed to look up card at MYT. Are they down?`);
	}

	throw new ScoreImportFatalError(
		400,
		`Couldn't find ${GetGameGroupConfig(game).name} profile on MYT.`,
	);
}
