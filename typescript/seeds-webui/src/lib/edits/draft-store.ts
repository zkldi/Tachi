import type { JsonPatch, JsonPatchOp } from "#lib/transport/transport";

// IndexedDB-backed draft store.
//
// A "draft" is a single JsonPatch op against one collection. The
// DraftsDrawer presents them grouped by collection and lets the user
// Apply -> transport.writeCollection(name, composedPatch) or Discard.

const DB_NAME = "seeds-webui";
const STORE = "drafts";
const DB_VERSION = 1;

export interface Draft {
	id: string;
	collection: string;
	op: JsonPatchOp;
	createdAt: number;
	label?: string;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: "id" });
				store.createIndex("collection", "collection", { unique: false });
			}
		};
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
	});
}

function genId(): string {
	// crypto.randomUUID is available in all modern browsers; fall back to a
	// time+random composite if not (e.g. some test environments).
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addDraft(draft: Omit<Draft, "createdAt" | "id">): Promise<Draft> {
	const db = await openDb();
	const full: Draft = { ...draft, createdAt: Date.now(), id: genId() };
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(full);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	return full;
}

export async function listDrafts(): Promise<Draft[]> {
	const db = await openDb();
	return new Promise<Draft[]>((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const req = tx.objectStore(STORE).getAll();
		req.onerror = () => reject(req.error);
		req.onsuccess = () =>
			resolve((req.result as Draft[]).sort((a, b) => a.createdAt - b.createdAt));
	});
}

export async function removeDraft(id: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function clearDrafts(collection?: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		const store = tx.objectStore(STORE);
		if (collection === undefined) {
			store.clear();
		} else {
			const idx = store.index("collection");
			const req = idx.openCursor(IDBKeyRange.only(collection));
			req.onsuccess = () => {
				const cursor = req.result;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				}
			};
		}
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export function composeDrafts(drafts: Draft[]): Map<string, JsonPatch> {
	const grouped = new Map<string, JsonPatch>();
	for (const d of drafts) {
		const bucket = grouped.get(d.collection) ?? [];
		bucket.push(d.op);
		grouped.set(d.collection, bucket);
	}
	return grouped;
}
