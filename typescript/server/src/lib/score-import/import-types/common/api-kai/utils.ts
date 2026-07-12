import { ServerConfig } from "#lib/setup/config";

export function KaiTypeToBaseURL(kaiType: "EAG" | "FLO" | "MIN") {
	switch (kaiType) {
		case "FLO": {
			if (!ServerConfig.FLO_API_URL) {
				throw new Error(`Got kaiType FLO, but no API_URL was defined?`);
			}

			return ServerConfig.FLO_API_URL;
		}

		case "EAG": {
			if (!ServerConfig.EAG_API_URL) {
				throw new Error(`Got kaiType EAG, but no API_URL was defined?`);
			}

			return ServerConfig.EAG_API_URL;
		}

		case "MIN": {
			if (!ServerConfig.MIN_API_URL) {
				throw new Error(`Got kaiType MIN, but no API_URL was defined?`);
			}

			return ServerConfig.MIN_API_URL;
		}

		default:
			throw new Error(`Invalid Kai Type ${kaiType} provided.`);
	}
}

export function GetKaiTypeClientCredentials(kaiType: "EAG" | "FLO" | "MIN") {
	if (kaiType === "FLO") {
		return ServerConfig.FLO_OAUTH2_INFO;
	} else if (kaiType === "EAG") {
		return ServerConfig.EAG_OAUTH2_INFO;
	}

	return ServerConfig.MIN_OAUTH2_INFO;
}
