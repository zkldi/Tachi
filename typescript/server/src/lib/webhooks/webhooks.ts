import type { WebhookEvents } from "tachi-common";

import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";

export async function GetWebhookUrlInfo() {
	const rows = await DB.selectFrom("priv_api_client")
		.select(["client_secret", "webhook_uri"])
		.where("webhook_uri", "is not", null)
		.execute();

	return rows.map((r) => ({ clientSecret: r.client_secret, webhookUri: r.webhook_uri }));
}

/**
 * Emits a webhook event to all registered client webhooks on this tachi-server install.
 */
export async function EmitWebhookEvent(content: WebhookEvents) {
	const webhookUrls = await GetWebhookUrlInfo();

	log.debug(`Emitting webhook event ${content.type} to ${webhookUrls.length} clients.`);

	// We don't actually care about the response of these. Just fire them and forget.
	for (const client of webhookUrls) {
		// we know this to be non-null because of GetWebhookUrlInfo.
		fetch(client.webhookUri!, {
			method: "POST",
			body: JSON.stringify(content),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${client.clientSecret}`,
			},
		}).catch((err: Error) => {
			// We don't care about errors. It's probably on their end.
			log.info(err.message);
		});
	}
}
