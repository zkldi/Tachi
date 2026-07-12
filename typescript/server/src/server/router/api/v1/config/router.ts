import { success } from "#lib/router/typed-router";
import { ServerConfig, TachiConfig } from "#lib/setup/config";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Returns Tachi Configuration info, such as server name, type, supported games
 * and more.
 */
API_V1_ROUTER.add("GET /config", () => success("Returned configuration info.", TachiConfig));

/**
 * Returns the value of the BEATORAJA_QUEUE_SIZE.
 */
API_V1_ROUTER.add("GET /config/beatoraja-queue-size", () =>
	success("Returned BEATORAJA_QUEUE_SIZE.", ServerConfig.BEATORAJA_QUEUE_SIZE),
);

/**
 * Returns the maximum amount of rivals a user can have on this instance.
 */
API_V1_ROUTER.add("GET /config/max-rivals", () =>
	success("Returned MAX_RIVALS.", ServerConfig.MAX_RIVALS),
);
