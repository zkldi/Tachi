// Module-level cache for on-disk collection data.
//
// Shared across Drafts, Bulk-edit, and any other page that needs to load a
// collection to compute diffs. One network round-trip per collection name per
// page load. Call `bustCollection` / `bustAll` after writes so the next
// consumer sees fresh data.

import { getTransport } from "#lib/transport/transport";

const cache = new Map<string, Promise<unknown[]>>();

export function fetchCollection(name: string): Promise<unknown[]> {
	if (!cache.has(name)) {
		cache.set(
			name,
			getTransport().then((t) => t.getCollection(name) as Promise<unknown[]>),
		);
	}
	return cache.get(name)!;
}

export function bustCollection(name: string): void {
	cache.delete(name);
}

export function bustAll(): void {
	cache.clear();
}
