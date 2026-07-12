import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup, KaiAuthDocument } from "tachi-common";

import nodeFetch from "#utils/fetch";

import type { KaiContext } from "../types";

import { applyKaiTimestop } from "../kai-timestop";
import { CreateKaiReauthFunction } from "../reauth";
import { TraverseKaiAPI } from "../traverse-api";
import { KaiTypeToBaseURL } from "../utils";
import { CreateKaiIIDXClassProvider } from "./class-handler";

export async function ParseKaiIIDX(
	service: "EAG" | "FLO",
	authDoc: KaiAuthDocument,
	log: KtLogger,
	fetch = nodeFetch,
	reauthFn: (() => Promise<string>) | null = null,
	lastScoreTime: Date | null = null,
): Promise<ParserFunctionReturns<unknown, KaiContext, GamesForGroup["iidx"]>> {
	const baseUrl = KaiTypeToBaseURL(service);

	const resolvedReauthFn = reauthFn ?? CreateKaiReauthFunction(service, authDoc, log, fetch);

	// auth *before* starting import to avoid a partial-import
	authDoc.token = await resolvedReauthFn();

	return {
		service,
		iterable: applyKaiTimestop(
			TraverseKaiAPI(
				baseUrl,
				"/api/iidx/v2/play_history",
				authDoc.token,
				log,
				resolvedReauthFn,
				fetch,
			),
			lastScoreTime,
		),
		context: {
			service,
		},
		classProvider: await CreateKaiIIDXClassProvider(
			service,
			authDoc.token,
			resolvedReauthFn,
			fetch,
		),
		gameGroup: "iidx",
	};
}
