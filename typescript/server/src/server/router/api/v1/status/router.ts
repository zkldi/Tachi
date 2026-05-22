import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { VERSION_PRETTY } from "#lib/constants/version";

import { API_V1_ROUTER } from "../_singleton";

const startTime = Date.now();

/**
 * Returns the current status of the Tachi Server.
 */
API_V1_ROUTER.add("GET /status", ({ input, req }) => {
	let echo;

	if (typeof input.echo === "string") {
		echo = input.echo;
	}

	return {
		success: true,
		description: "Status check successful.",
		body: {
			serverTime: Date.now(),
			startTime,
			version: VERSION_PRETTY,
			whoami: req[SYMBOL_TACHI_API_AUTH].userID,

			// converts {foo: true, bar: false, baz: true} into [foo, baz]
			permissions: Object.entries(req[SYMBOL_TACHI_API_AUTH].permissions)
				.filter((e) => e[1])
				.map((e) => e[0]),
			echo,
		},
	};
});

/**
 * Returns the current status of the Tachi Server, but as a POST
 * request, for that kind of testing.
 *
 * @name POST /api/v1/status
 */
API_V1_ROUTER.add("POST /status", ({ input, req }) => {
	let echo;

	if (typeof input.echo === "string") {
		echo = input.echo;
	}

	return {
		success: true,
		description: "Status check successful.",
		body: {
			serverTime: Date.now(),
			startTime,
			version: VERSION_PRETTY,
			whoami: req[SYMBOL_TACHI_API_AUTH].userID,

			// converts {foo: true, bar: false, baz: true} into [foo, baz]
			permissions: Object.entries(req[SYMBOL_TACHI_API_AUTH].permissions)
				.filter((e) => e[1])
				.map((e) => e[0]),
			echo,
		},
	};
});
