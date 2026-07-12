import type { SeedsTransport } from "#lib/transport/transport";

import { getSqlite } from "./client";

// Fast content hash for JSON payloads. We hash the serialised string because
// getCollection returns parsed JSON; this matches what scripts/bundle-current-seeds
// stores (sha256(prefix-16) of the raw file bytes - close enough for change detection).
async function hashJson(value: unknown): Promise<string> {
	const s = JSON.stringify(value);
	const buf = new TextEncoder().encode(s);
	const digest = await crypto.subtle.digest("SHA-256", buf);
	return [...new Uint8Array(digest).slice(0, 8)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export interface BuildProgress {
	name: string;
	idx: number;
	total: number;
	rows: number;
	cached: boolean;
}

export async function* buildSqliteFromTransport(
	transport: SeedsTransport,
	rev?: string,
): AsyncGenerator<BuildProgress> {
	const sqlite = getSqlite();
	await sqlite.init();

	const names = await transport.listCollections();
	const meta = rev === undefined ? await sqlite.getMeta() : {};

	for (let i = 0; i < names.length; i++) {
		const name = names[i]!;
		const rows = await transport.getCollection(name, rev);
		const hash = await hashJson(rows);
		// When rev !== undefined we *always* re-ingest - the caller is looking at
		// a specific commit, not the working copy, and we don't cache historical
		// loads to avoid OPFS bloat.
		if (rev === undefined && meta[name] === hash) {
			yield { cached: true, idx: i, name, rows: rows.length, total: names.length };
			continue;
		}
		await sqlite.ingest(name, rows, rev === undefined ? hash : `rev:${rev}`);
		yield { cached: false, idx: i, name, rows: rows.length, total: names.length };
	}
}
