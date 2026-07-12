import type { KtLogger } from "#lib/log/log";
import type { CGCardInfo } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ServerConfig } from "#lib/setup/config";
import nodeFetch, { type NodeFetch } from "#utils/fetch";
import { p, type PrudenceSchema } from "prudence";
import { URLSearchParams } from "url";

import type { CGErrorResponse, CGScoresResponse, CGServices, CGSupportedGames } from "./types";

const PR_CG_RESPONSE: PrudenceSchema = {
	success: "boolean",
	data: {
		profile: {
			id: "string",
			name: "string",
		},

		// validated elsewhere
		scores: [p.any],
	},
};

const PR_CG_ERR_RESPONSE: PrudenceSchema = {
	success: "boolean",
	message: "string",
};

/**
 * Fetch this info from CG. **This function does not validate the content of scores**,
 * instead, that should be handled by the parser.
 */
export async function FetchCGScores(
	service: CGServices,
	cardInfo: CGCardInfo,
	game: CGSupportedGames,
	log: KtLogger,
	fetch: NodeFetch = nodeFetch,
): Promise<Array<unknown>> {
	const url = GetCGUrl(service, cardInfo, game);

	let validatedRes: CGErrorResponse | CGScoresResponse<unknown>;

	try {
		const res: unknown = await fetch(url).then((r) => r.json());

		const prErr = p({ res }, { res: p.or(PR_CG_RESPONSE, PR_CG_ERR_RESPONSE) });

		if (prErr) {
			log.error({ res }, `Got unexpected data from CG.`);
			throw new Error(`Got unexpected data from CG.`);
		}

		validatedRes = res as CGErrorResponse | CGScoresResponse<unknown>;
	} catch (err) {
		log.error({ err }, `Received invalid response from ${url}.`);

		throw new ScoreImportFatalError(
			500,
			`Received invalid response from their API. Are they down?`,
		);
	}

	if (validatedRes.success) {
		return validatedRes.data.scores;
	}

	throw new ScoreImportFatalError(
		400,
		`Failed to fetch data from CG. Error Message: ${validatedRes.message}.`,
	);
}

function GetCGConf(service: CGServices) {
	let conf;

	switch (service) {
		case "dev": {
			conf = ServerConfig.CG_DEV_CONFIG;
			break;
		}

		case "nag": {
			conf = ServerConfig.CG_NAG_CONFIG;
			break;
		}

		case "gan": {
			conf = ServerConfig.CG_GAN_CONFIG;
			break;
		}
	}

	if (!conf) {
		throw new ScoreImportFatalError(
			500,
			`Tried to get ${service} CG conf, yet was not defined?`,
		);
	}

	return conf;
}

function GetCGUrl(service: CGServices, cardInfo: CGCardInfo, game: CGSupportedGames) {
	const cgConf = GetCGConf(service);

	const params = new URLSearchParams();

	params.set("api_key", cgConf.API_KEY);
	params.set("card_id", cardInfo.cardID);
	params.set("pin", cardInfo.pin);

	return `${cgConf.URL}/${game}-scores?${params.toString()}`;
}
