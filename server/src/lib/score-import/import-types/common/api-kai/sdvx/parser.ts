import { CreateKaiSDVXClassProvider } from "./class-handler";
import { CreateKaiReauthFunction } from "../reauth";
import { TraverseKaiAPI } from "../traverse-api";
import { KaiTypeToBaseURL } from "../utils";
import nodeFetch from "utils/fetch";
import type { ParserFunctionReturns } from "../../types";
import type { KaiContext } from "../types";
import type { KtLogger } from "lib/logger/logger";
import type { KaiAuthDocument } from "tachi-common";

export async function ParseKaiSDVX(
	service: "EAG" | "FLO" | "MIN",
	authDoc: KaiAuthDocument,
	logger: KtLogger,
	fetch = nodeFetch
): Promise<ParserFunctionReturns<unknown, KaiContext>> {
	const baseUrl = KaiTypeToBaseURL(service);

	const reauthFn = CreateKaiReauthFunction(service, authDoc, logger, fetch);

	// auth *before* starting import to avoid a partial-import
	authDoc.token = await reauthFn();

	return {
		iterable: TraverseKaiAPI(
			baseUrl,
			"/api/sdvx/v1/play_history",
			authDoc.token,
			logger,
			reauthFn,
			fetch
		),
		context: {
			service,
		},
		classProvider: await CreateKaiSDVXClassProvider(service, authDoc.token, reauthFn, fetch),
		game: "sdvx",
	};
}
