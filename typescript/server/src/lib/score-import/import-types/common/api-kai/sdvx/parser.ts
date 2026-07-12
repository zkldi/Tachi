import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup, KaiAuthDocument } from "tachi-common";

import nodeFetch from "#utils/fetch";

import type { KaiContext } from "../types";

import { applyKaiTimestop } from "../kai-timestop";
import { CreateKaiReauthFunction } from "../reauth";
import { type KaiAPIReauthFunction, TraverseKaiAPI } from "../traverse-api";
import { KaiTypeToBaseURL } from "../utils";
import { CreateKaiSDVXClassProvider } from "./class-handler";

export async function ParseKaiSDVX(
	service: "EAG" | "FLO" | "MIN",
	authDoc: KaiAuthDocument,
	log: KtLogger,
	fetch = nodeFetch,
	reauthFn: KaiAPIReauthFunction | null = null,
	lastScoreTime: Date | null = null,
): Promise<ParserFunctionReturns<unknown, KaiContext, GamesForGroup["sdvx"]>> {
	const baseUrl = KaiTypeToBaseURL(service);

	const resolvedReauthFn = reauthFn ?? CreateKaiReauthFunction(service, authDoc, log, fetch);

	// auth *before* starting import to avoid a partial-import
	authDoc.token = await resolvedReauthFn();

	return {
		service,
		iterable: applyKaiTimestop(
			TraverseKaiAPI(
				baseUrl,
				"/api/sdvx/v1/play_history",
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
		classProvider: await CreateKaiSDVXClassProvider(
			service,
			authDoc.token,
			resolvedReauthFn,
			fetch,
		),
		gameGroup: "sdvx",
	};
}
