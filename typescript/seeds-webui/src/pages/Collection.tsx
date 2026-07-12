import type { V3Game } from "tachi-common/types";
import type { z } from "zod";

import { RowEditor } from "#components/RowEditor";
import { EDIT_MODE } from "#lib/config";
import { PK_KEYS } from "#lib/diff/row-primary-key";
import { addDraft } from "#lib/edits/draft-store";
import { prettySeedDocSummary } from "#lib/format/seed-doc-summary";
import { useIngest } from "#lib/ingest/IngestProvider";
import { getSqlite } from "#lib/sqlite/client";
import { type Flavour, flavourFor, tableNameFor } from "#lib/sqlite/schema";
import { getTransport } from "#lib/transport/transport";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { useParams } from "react-router-dom";
import { GameToGameGroup } from "tachi-common/config/config";

/** Rows rendered per page — keeps DOM small while SQLite still loads full filtered sets. */
const COLLECTION_PAGE_SIZE = 500;

export function Collection() {
	const { name } = useParams<{ name: string }>();
	const [filter, setFilter] = useState("");
	const [page, setPage] = useState(0);
	const [drawer, setDrawer] = useState<DrawerState | null>(null);
	const { ready } = useIngest();
	const qc = useQueryClient();

	const table = tableNameFor(name);
	const flav = useMemo<Flavour | null>(() => {
		try {
			return flavourFor(name);
		} catch {
			return null;
		}
	}, [name]);

	// Lazy-loaded zod schema for the current collection. We only import the
	// schemas module when EDIT_MODE is on so the prod bundle doesn't ship the
	// whole tachi-common game config tree.
	const [schema, setSchema] = useState<z.ZodType<unknown> | null>(null);
	useEffect(() => {
		if (!EDIT_MODE) {
			return;
		}
		let alive = true;
		import("#lib/edits/schemas")
			.then((m) => {
				if (alive) {
					setSchema(m.schemaForCollection(name));
				}
			})
			.catch((err) => {
				console.error("[seeds-webui] failed to load schemas:", err);
			});
		return () => {
			alive = false;
		};
	}, [name]);

	// For chart collections we know the V3Game and can join the songs table.
	const chartGame = useMemo<V3Game | null>(() => {
		if (flav !== "charts") {
			return null;
		}
		const game = name.replace(/^charts-/u, "").replace(/\.json$/u, "") as V3Game;
		return game;
	}, [flav, name]);

	const songTable = useMemo<string | null>(() => {
		if (!chartGame) {
			return null;
		}
		const group = GameToGameGroup(chartGame);
		return tableNameFor(`songs-${group}.json`);
	}, [chartGame]);

	const rows = useQuery(
		["collection-rows", table, filter, songTable],
		async () => {
			if (flav === "charts" && songTable) {
				// Join song title/artist so SeedDocItem can show meaningful info.
				// Match filter against chart JSON *or* joined song JSON so queries like a song title still find rows (issue #67).
				const where = filter
					? `WHERE (c.raw LIKE '%' || ? || '%' OR IFNULL(s.raw, '') LIKE '%' || ? || '%')`
					: "";
				const chartParams: unknown[] = filter ? [filter, filter] : [];
				return getSqlite().query(
					`SELECT c.raw, s.raw FROM "${table}" c LEFT JOIN "${songTable}" s ON c.songID = s.id ${where}`,
					chartParams,
				);
			}
			const params: unknown[] = filter ? [filter] : [];
			const where = filter ? `WHERE raw LIKE '%' || ? || '%'` : "";
			return getSqlite().query(`SELECT raw FROM "${table}" ${where}`, params);
		},
		{ enabled: ready, keepPreviousData: true },
	);

	const entries = useMemo<SeedDocEntry[]>(() => {
		if (!rows.data) {
			return [];
		}
		const out: SeedDocEntry[] = [];
		for (const row of rows.data.rows) {
			const doc = safeParseRaw(row[0]);
			if (!doc) {
				continue;
			}
			if (flav === "charts" && chartGame) {
				const songDoc = safeParseRaw(row[1]);
				out.push({ doc, game: chartGame, songDoc: songDoc ?? undefined });
			} else {
				out.push({ doc });
			}
		}
		return out;
	}, [rows.data, flav, chartGame]);

	const entryCount = entries.length;
	const totalPages = entryCount === 0 ? 0 : Math.ceil(entryCount / COLLECTION_PAGE_SIZE);

	useEffect(() => {
		setPage(0);
	}, [name, filter]);

	useEffect(() => {
		if (totalPages === 0) {
			return;
		}
		setPage((p) => Math.min(p, totalPages - 1));
	}, [totalPages]);

	const pageIndex = totalPages === 0 ? 0 : Math.min(page, totalPages - 1);
	const sliceStart = pageIndex * COLLECTION_PAGE_SIZE;
	const pageEntries = useMemo(
		() => entries.slice(sliceStart, sliceStart + COLLECTION_PAGE_SIZE),
		[entries, sliceStart],
	);

	function openEdit(doc: Record<string, unknown>) {
		setDrawer({ initial: doc, mode: "edit" });
	}

	function openAdd() {
		setDrawer({ initial: {}, mode: "add" });
	}

	async function stageReplace(before: Record<string, unknown>, after: unknown) {
		const idx = await findRowIndex(name, before);
		if (idx < 0) {
			throw new Error(`could not locate row in ${name}`);
		}
		await addDraft({
			collection: name,
			label: summariseEntry(name, { doc: before }),
			op: { op: "replace", path: `/${idx}`, value: after },
		});
	}

	async function stageAdd(row: unknown) {
		await addDraft({
			collection: name,
			label: "new row",
			op: { op: "add", path: "/-", value: row },
		});
	}

	async function stageDelete(entry: SeedDocEntry) {
		const label = summariseEntry(name, entry);
		if (!confirm(`Stage a delete for "${label}"?`)) {
			return;
		}
		const idx = await findRowIndex(name, entry.doc);
		if (idx < 0) {
			alert(`Could not locate row in ${name}. It may already be gone.`);
			return;
		}
		await addDraft({
			collection: name,
			label: `delete ${label}`,
			op: { op: "remove", path: `/${idx}` },
		});
	}

	async function handleDrawerSave(value: unknown) {
		if (!drawer) {
			return;
		}
		try {
			if (drawer.mode === "edit") {
				await stageReplace(drawer.initial as Record<string, unknown>, value);
			} else {
				await stageAdd(value);
			}
			setDrawer(null);
			await qc.invalidateQueries(["collection-rows", table]);
		} catch (err) {
			alert(err instanceof Error ? err.message : String(err));
		}
	}

	return (
		<div>
			<h2 className="page-title mono">{name}</h2>
			<div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
				<input
					className="form-control"
					onChange={(e) => setFilter(e.target.value)}
					placeholder={
						flav === "charts" && songTable
							? "filter (chart JSON or joined song JSON)"
							: "filter (LIKE match against raw JSON)"
					}
					style={{ flex: 1, minWidth: 240 }}
					value={filter}
				/>
				{EDIT_MODE ? (
					<button
						className="btn btn-primary"
						disabled={!schema}
						onClick={openAdd}
						title={schema ? undefined : "No schema available for this collection"}
						type="button"
					>
						+ Add row
					</button>
				) : null}
			</div>

			{!schema && EDIT_MODE ? (
				<div className="alert alert-warning mono">
					No zod schema found for this collection - editing is unavailable.
				</div>
			) : null}

			{rows.isLoading ? (
				<div className="text-muted">Loading…</div>
			) : (
				<>
					{totalPages > 1 ? (
						<div className="d-flex flex-wrap align-items-center gap-2 mb-2">
							<button
								className="btn btn-sm btn-outline-secondary"
								disabled={pageIndex <= 0}
								onClick={() => setPage((p) => Math.max(0, p - 1))}
								type="button"
							>
								Previous
							</button>
							<span className="text-muted mono small">
								Page {pageIndex + 1} / {totalPages} ({entryCount.toLocaleString()}{" "}
								rows)
							</span>
							<button
								className="btn btn-sm btn-outline-secondary"
								disabled={pageIndex >= totalPages - 1}
								onClick={() => setPage((p) => p + 1)}
								type="button"
							>
								Next
							</button>
						</div>
					) : null}
					<SeedDocList
						canEdit={EDIT_MODE && !!schema}
						collectionName={name}
						entries={pageEntries}
						entryKeyOffset={sliceStart}
						onDelete={(entry) => void stageDelete(entry)}
						onEdit={(entry) => openEdit(entry.doc)}
						totalEntryCount={entryCount}
					/>
				</>
			)}

			{drawer && schema ? (
				<Drawer onClose={() => setDrawer(null)}>
					<RowEditor
						initial={drawer.initial}
						onCancel={() => setDrawer(null)}
						onSave={(v) => void handleDrawerSave(v)}
						schema={schema}
						submitLabel={drawer.mode === "edit" ? "Stage change" : "Stage add"}
						title={drawer.mode === "edit" ? "Edit row" : "Add row"}
					/>
				</Drawer>
			) : null}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Data shapes

interface SeedDocEntry {
	doc: Record<string, unknown>;
	songDoc?: Record<string, unknown>;
	game?: string;
}

function summariseEntry(collectionName: string, entry: SeedDocEntry): string {
	return prettySeedDocSummary(collectionName, entry.doc, { songDoc: entry.songDoc });
}

// ---------------------------------------------------------------------------
// Document list

function SeedDocList({
	entries,
	totalEntryCount,
	entryKeyOffset,
	collectionName,
	canEdit,
	onEdit,
	onDelete,
}: {
	canEdit: boolean;
	collectionName: string;
	entries: SeedDocEntry[];
	entryKeyOffset: number;
	onDelete: (entry: SeedDocEntry) => void;
	onEdit: (entry: SeedDocEntry) => void;
	totalEntryCount: number;
}) {
	if (totalEntryCount === 0) {
		return <div className="text-muted mono">No documents.</div>;
	}

	const rangeEnd = entryKeyOffset + entries.length;

	return (
		<div className="seed-doc-list">
			{entries.map((entry, i) => (
				<SeedDocItem
					canEdit={canEdit}
					collectionName={collectionName}
					entry={entry}
					key={entryKeyOffset + i}
					onDelete={onDelete}
					onEdit={onEdit}
				/>
			))}
			<div className="result-foot">
				{entries.length < totalEntryCount
					? `Showing ${(entryKeyOffset + 1).toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalEntryCount.toLocaleString()} rows`
					: `${totalEntryCount.toLocaleString()} rows`}
			</div>
		</div>
	);
}

function SeedDocItem({
	entry,
	collectionName,
	canEdit,
	onEdit,
	onDelete,
}: {
	canEdit: boolean;
	collectionName: string;
	entry: SeedDocEntry;
	onDelete: (entry: SeedDocEntry) => void;
	onEdit: (entry: SeedDocEntry) => void;
}) {
	const [open, setOpen] = useState(false);
	const summary = summariseEntry(collectionName, entry);

	return (
		<div className="seed-doc-item">
			<div
				aria-expanded={open}
				className="seed-doc-head"
				onClick={() => setOpen((x) => !x)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setOpen((x) => !x);
					}
				}}
				role="button"
				tabIndex={0}
			>
				<span aria-hidden="true" className={`result-expander ${open ? "is-open" : ""}`}>
					▸
				</span>
				<span className="seed-doc-summary mono">{summary}</span>
				{canEdit ? (
					<div
						className="seed-doc-actions btn-group btn-group-sm"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="btn btn-outline-primary"
							onClick={() => onEdit(entry)}
							type="button"
						>
							Edit
						</button>
						<button
							className="btn btn-outline-danger"
							onClick={() => onDelete(entry)}
							type="button"
						>
							Delete
						</button>
					</div>
				) : null}
			</div>
			{open ? (
				<pre className="seed-doc-json mono">{JSON.stringify(entry.doc, null, 2)}</pre>
			) : null}
		</div>
	);
}

// ---------------------------------------------------------------------------

type DrawerState = { initial: unknown; mode: "add" } | { initial: unknown; mode: "edit" };

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
	return (
		<div className="drawer-backdrop" onMouseDown={onClose}>
			<aside
				aria-modal="true"
				className="drawer"
				onMouseDown={(e) => e.stopPropagation()}
				role="dialog"
			>
				<button aria-label="Close" className="drawer-close" onClick={onClose} type="button">
					×
				</button>
				{children}
			</aside>
		</div>
	);
}

function safeParseRaw(v: unknown): Record<string, unknown> | null {
	if (typeof v !== "string") {
		return null;
	}
	try {
		const parsed = JSON.parse(v);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// fall through
	}
	return null;
}

function pickPk(row: Record<string, unknown>): { key: string; value: number | string } | null {
	for (const k of PK_KEYS) {
		const v = row[k];
		if (typeof v === "string" || typeof v === "number") {
			return { key: k, value: v };
		}
	}
	return null;
}

// Locate a row's index inside the on-disk collection. Fetches the current
// working-copy / HEAD content, then matches by primary key.
async function findRowIndex(name: string, row: Record<string, unknown>): Promise<number> {
	const t = await getTransport();
	const data = await t.getCollection(name);
	const pk = pickPk(row);
	if (!pk) {
		return -1;
	}
	for (let i = 0; i < data.length; i++) {
		const r = data[i] as Record<string, unknown> | undefined;
		if (r && r[pk.key] === pk.value) {
			return i;
		}
	}
	return -1;
}
