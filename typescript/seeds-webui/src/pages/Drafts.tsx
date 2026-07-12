import { SingleRowDocumentDiff } from "#components/CollectionDiffRows";
import {
	clearDrafts,
	composeDrafts,
	type Draft,
	listDrafts,
	removeDraft,
} from "#lib/edits/draft-store";
import { applyMergeToRow, mergeToPatchOps, setValueAtPath } from "#lib/edits/patch-merge-ops";
import { bustAll, bustCollection, fetchCollection } from "#lib/transport/collection-cache";
import {
	getTransport,
	type JsonPatch,
	type JsonPatchOp,
	type SeedsTransport,
} from "#lib/transport/transport";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Build before/after document pair for a draft op (same shape as the commit
// diff “collection diff” row cards, via SingleRowDocumentDiff).
// ---------------------------------------------------------------------------

type DocPair = {
	after: Record<string, unknown> | null;
	before: Record<string, unknown> | null;
};

async function computeDocPair(draft: Draft): Promise<DocPair | null> {
	const { op, collection } = draft;

	if (op.op === "add") {
		return { after: op.value as Record<string, unknown>, before: null };
	}

	if (op.op === "remove") {
		const data = await fetchCollection(collection);
		const synth = /^\/~by-([^/]+)~\/([^/]+)/u.exec(op.path);
		if (synth) {
			const [, field, enc] = synth;
			const val = decodeURIComponent(enc!);
			const row = (data as Record<string, unknown>[]).find((r) => String(r[field!]) === val);
			return { after: null, before: row ?? null };
		}
		const idxM = /^\/(\d+)/u.exec(op.path);
		if (idxM) {
			return {
				after: null,
				before: (data[parseInt(idxM[1]!, 10)] as Record<string, unknown>) ?? null,
			};
		}
		return { after: null, before: null };
	}

	if (op.op === "replace") {
		const synth = /^\/~by-([^/]+)~\/([^/]+)\/(.+)$/u.exec(op.path);
		if (synth) {
			const [, field, enc, tail] = synth;
			const val = decodeURIComponent(enc!);
			const data = await fetchCollection(collection);
			const row = (data as Record<string, unknown>[]).find((r) => String(r[field!]) === val);
			if (!row) {
				return null;
			}

			if (tail === "__merge__") {
				const patch = op.value as Record<string, unknown>;
				return { after: applyMergeToRow(row, patch), before: row };
			}
			const pathSegs = tail.split("/").filter(Boolean);
			return { after: setValueAtPath(row, pathSegs, op.value), before: row };
		}

		// Direct array-index path: /idx  or  /idx/field/...
		const parts = op.path.split("/").filter(Boolean);
		if (parts.length > 0 && !isNaN(Number(parts[0]))) {
			const idx = Number(parts[0]);
			const data = await fetchCollection(collection);
			const row = data[idx] as Record<string, unknown> | undefined;
			if (!row) {
				return null;
			}
			if (parts.length === 1) {
				return { after: op.value as Record<string, unknown>, before: row };
			}
			const fieldPath = parts.slice(1);
			return { after: setValueAtPath(row, fieldPath, op.value), before: row };
		}

		return { after: op.value as Record<string, unknown>, before: null };
	}

	return null;
}

// ---------------------------------------------------------------------------
// Draft item - op / time / discard in a slim bar; diff card always visible
// (same id=…, optional pretty title, field table, Show JSON as on /diff).
// ---------------------------------------------------------------------------

function DraftItem({ draft, onDiscard }: { draft: Draft; onDiscard: () => void }) {
	const [diffLoading, setDiffLoading] = useState(true);
	const [docPair, setDocPair] = useState<DocPair | null>(null);
	const [diffError, setDiffError] = useState<string | null>(null);
	const draftRef = useRef(draft);
	draftRef.current = draft;

	useEffect(() => {
		let cancelled = false;
		setDiffLoading(true);
		setDiffError(null);
		void computeDocPair(draftRef.current)
			.then((p) => {
				if (!cancelled) {
					setDocPair(p);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setDiffError(err instanceof Error ? err.message : String(err));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setDiffLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [draft.id]);

	const { op, createdAt } = draft;
	const opClass =
		op.op === "add"
			? "badge-op-add"
			: op.op === "remove"
				? "badge-op-remove"
				: "badge-op-replace";

	return (
		<div className="draft-item">
			<div className="draft-item-toolbar">
				<span className={`draft-op-badge ${opClass}`}>{op.op}</span>
				<span className="draft-item-time">{new Date(createdAt).toLocaleTimeString()}</span>
				<span className="draft-item-toolbar-spacer" />
				<button
					className="draft-item-drop"
					onClick={() => onDiscard()}
					title="Discard this edit"
					type="button"
				>
					×
				</button>
			</div>
			<div className="draft-item-diff">
				{diffLoading ? (
					<div className="draft-diff-loading">Loading diff…</div>
				) : diffError ? (
					<div className="draft-diff-error">{diffError}</div>
				) : docPair ? (
					<SingleRowDocumentDiff
						after={docPair.after}
						before={docPair.before}
						collectionName={draft.collection}
					/>
				) : (
					<div className="draft-diff-loading">No diff available.</div>
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Collection group.
// ---------------------------------------------------------------------------

interface DraftCollectionProps {
	collection: string;
	drafts: Draft[];
	onDiscard: (id: string) => Promise<void>;
	onDiscardCollection: () => Promise<void>;
}

function DraftCollection({
	collection,
	drafts,
	onDiscard,
	onDiscardCollection,
}: DraftCollectionProps) {
	return (
		<div className="draft-collection">
			<div className="draft-collection-head">
				<code className="draft-collection-name">{collection}</code>
				<span className="draft-collection-count">
					{drafts.length} {drafts.length === 1 ? "op" : "ops"}
				</span>
				<button
					className="btn btn-sm btn-outline-danger"
					onClick={() => void onDiscardCollection()}
					type="button"
				>
					Discard all
				</button>
			</div>
			<div className="draft-collection-items">
				{drafts.map((d) => (
					<DraftItem draft={d} key={d.id} onDiscard={() => void onDiscard(d.id)} />
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page root.
// ---------------------------------------------------------------------------

export function Drafts() {
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [applying, setApplying] = useState(false);

	const refresh = useCallback(async () => {
		setDrafts(await listDrafts());
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function apply() {
		setError(null);
		setApplying(true);
		try {
			const transport = await getTransport();
			if (!transport.writeCollection) {
				throw new Error("Transport is read-only (not in localdev).");
			}
			const grouped = composeDrafts(drafts);
			for (const [collection, patch] of grouped) {
				const expanded = await expandPatch(transport, collection, patch);
				await transport.writeCollection(collection, expanded);
			}
			await clearDrafts();
			// Bust collection cache so the next expand shows fresh data.
			bustAll();
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setApplying(false);
		}
	}

	const byCollection = new Map<string, Draft[]>();
	for (const d of drafts) {
		const bucket = byCollection.get(d.collection) ?? [];
		bucket.push(d);
		byCollection.set(d.collection, bucket);
	}

	return (
		<div>
			<div className="drafts-header">
				<div>
					<h2 className="page-title">
						Drafts
						{drafts.length > 0 ? (
							<span className="drafts-count-badge">{drafts.length}</span>
						) : null}
					</h2>
					<p className="page-subtitle">
						Staged edits. Apply to write them to disk - seeds are re-sorted
						automatically.
					</p>
				</div>
				<div className="drafts-actions">
					<button
						className="btn btn-primary"
						disabled={drafts.length === 0 || applying}
						onClick={() => void apply()}
					>
						{applying ? "Applying…" : `Apply all (${drafts.length})`}
					</button>
					<button
						className="btn btn-outline-danger"
						disabled={drafts.length === 0}
						onClick={async () => {
							await clearDrafts();
							bustAll();
							await refresh();
						}}
					>
						Discard all
					</button>
				</div>
			</div>

			{error ? <div className="alert alert-danger mono mb-3">{error}</div> : null}

			{drafts.length === 0 ? (
				<div className="drafts-empty">
					<div className="drafts-empty-icon">✎</div>
					<div className="drafts-empty-title">No staged edits</div>
					<p>Stage some from Bulk edit or a row editor.</p>
				</div>
			) : (
				<div className="drafts-collections">
					{[...byCollection.entries()].map(([collection, group]) => (
						<DraftCollection
							collection={collection}
							drafts={group}
							key={collection}
							onDiscard={async (id) => {
								await removeDraft(id);
								await refresh();
							}}
							onDiscardCollection={async () => {
								await clearDrafts(collection);
								bustCollection(collection);
								await refresh();
							}}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Apply helpers
// ---------------------------------------------------------------------------

async function expandPatch(
	transport: SeedsTransport,
	collection: string,
	patch: JsonPatch,
): Promise<JsonPatch> {
	const synthetic = patch.some((op) => /^\/~by-[^/]+~\//u.test(op.path));
	if (!synthetic) {
		return patch;
	}

	const current = (await transport.getCollection(collection)) as Array<Record<string, unknown>>;
	const out: JsonPatch = [];
	for (const op of patch) {
		const m = /^\/~by-([^/]+)~\/([^/]+)\/(.+)$/u.exec(op.path);
		if (!m) {
			out.push(op);
			continue;
		}
		const [, field, encValue, tail] = m;
		const value = decodeURIComponent(encValue!);
		const idx = current.findIndex((r) => String(r[field!]) === value);
		if (idx < 0) {
			throw new Error(`draft refers to ${field}=${value} but no such row in ${collection}`);
		}
		if (tail === "__merge__" && op.op === "replace") {
			const patchObj = op.value as Record<string, unknown>;
			const row = current[idx]!;
			out.push(...mergeToPatchOps(row, idx, patchObj));
		} else {
			out.push({
				...op,
				path: `/${idx}/${tail}`,
			} as JsonPatchOp);
		}
	}
	return out;
}
