import { URL } from "node:url";

const PRIVATE_IP_RANGES = [
	/^127\./u,
	/^10\./u,
	/^172\.(1[6-9]|2\d|3[01])\./u,
	/^192\.168\./u,
	/^169\.254\./u,
	/^0\./u,
	/^::1$/u,
	/^fc00:/u,
	/^fe80:/u,
];

const PRIVATE_HOSTNAMES = new Set(["", "localhost", "localhost.localdomain"]);

/**
 * Returns `null` if the URI is acceptable, or a rejection reason string.
 * Only `https:` URIs targeting public hosts are allowed.
 */
export function validateWebhookUri(uri: string): string | null {
	let parsed: URL;

	try {
		parsed = new URL(uri);
	} catch {
		return "webhookUri is not a valid URL.";
	}

	if (parsed.protocol !== "https:") {
		return "webhookUri must use https.";
	}

	const hostname = parsed.hostname.toLowerCase();

	if (PRIVATE_HOSTNAMES.has(hostname)) {
		return "webhookUri must not target localhost.";
	}

	for (const re of PRIVATE_IP_RANGES) {
		if (re.test(hostname)) {
			return "webhookUri must not target a private or link-local IP address.";
		}
	}

	return null;
}
