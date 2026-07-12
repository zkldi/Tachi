import type { QueryResult } from "#lib/sqlite/types";

import { SingleRowDocumentDiff } from "#components/CollectionDiffRows";
import { ResultTable } from "#components/ResultTable";
import { SqlEditor } from "#components/SqlEditor";
import { SqliteWorkspaceGate } from "#components/SqliteWorkspaceGate";
import { validateBulkMergeRow } from "#lib/edits/bulk-merge-validation";
import { addDraft } from "#lib/edits/draft-store";
import { applyMergeToRow } from "#lib/edits/patch-merge-ops";
import { schemaForCollection } from "#lib/edits/schemas";
import { useIngest } from "#lib/ingest/IngestProvider";
import { getSqlite } from "#lib/sqlite/client";
import { flavourFor, tableNameFor } from "#lib/sqlite/schema";
import { fetchCollection } from "#lib/transport/collection-cache";
import { useEffect, useRef, useState } from "react";

const SAFE_SQL_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/u;

// Query-then-patch bulk editor. Flow:
//   1. Write a SELECT that finds rows you want to change (must include a
//      primary-key-ish column).
//   2. Preview rows.
//   3. Enter a JSON object of fields to merge onto each matching row.
//   4. Review the generated patch ops; "Stage" to enqueue as drafts, then
//      apply from the Drafts drawer.
const DEFAULT_BULK_SQL = `SELECT id FROM charts_iidx_sp WHERE levelNum >= 12;`;

export function Bulk() {
	const { ready: sqliteReady } = useIngest();
	const [sql, setSql] = useState(
		() => localStorage.getItem("seeds-webui:bulk-preview-sql") ?? DEFAULT_BULK_SQL,
	);
	const sqlRef = useRef(sql);
	sqlRef.current = sql;
	const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
	const [collection, setCollection] = useState("charts-iidx-sp.json");
	const [pkField, setPkField] = useState("id");
	const [patchJson, setPatchJson] = useState(`{"level": "11", "data": {"badChart": true}}`);
	const [preview, setPreview] = useState<QueryResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [staged, setStaged] = useState(0);

	useEffect(() => {
		if (!sqliteReady) {
			return;
		}
		let cancelled = false;
		void getSqlite()
			.getSchema()
			.then((s) => {
				if (!cancelled) {
					setSchema(s);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setSchema({});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [sqliteReady]);

	// Parse patch eagerly so we can detect syntax errors before staging.
	const [patch, patchError] = useParsedPatch(patchJson);

	async function runPreview() {
		const text = sqlRef.current;
		setError(null);
		try {
			setPreview(await getSqlite().query(text));
			localStorage.setItem("seeds-webui:bulk-preview-sql", text);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function stage() {
		if (!preview || !patch) {
			return;
		}
		const pkIdx = preview.columns.indexOf(pkField);
		if (pkIdx < 0) {
			setError(`Primary-key column "${pkField}" not found in preview`);
			return;
		}
		if (!SAFE_SQL_IDENT.test(pkField)) {
			setError(
				`Primary-key column must be a simple identifier (letters, digits, underscore).`,
			);
			return;
		}

		const zodSchema = schemaForCollection(collection);
		if (!zodSchema) {
			setError(
				`No Zod schema for "${collection}". Bulk staging only allows collections with a known document type.`,
			);
			return;
		}

		let table: string;
		try {
			flavourFor(collection);
			table = tableNameFor(collection);
		} catch {
			setError(`Unknown collection flavour for "${collection}".`);
			return;
		}

		const pks: unknown[] = [];
		for (const row of preview.rows) {
			const pk = row[pkIdx];
			if (pk !== null && pk !== undefined) {
				pks.push(pk);
			}
		}
		if (pks.length === 0) {
			setError("No primary-key values in preview to stage.");
			return;
		}

		const placeholders = pks.map(() => "?").join(", ");
		let loaded: QueryResult;
		try {
			loaded = await getSqlite().query(
				`SELECT "${pkField}", raw FROM "${table}" WHERE "${pkField}" IN (${placeholders})`,
				pks,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return;
		}
		const loadPkIdx = loaded.columns.indexOf(pkField);
		const rawIdx = loaded.columns.indexOf("raw");
		if (loadPkIdx < 0 || rawIdx < 0) {
			setError("SQLite result missing pk or raw column.");
			return;
		}
		const byPk = new Map<string, Record<string, unknown>>();
		for (const lr of loaded.rows) {
			const rawCell = lr[rawIdx];
			if (typeof rawCell !== "string") {
				continue;
			}
			try {
				byPk.set(String(lr[loadPkIdx]), JSON.parse(rawCell) as Record<string, unknown>);
			} catch {
				setError(`Invalid JSON in raw for ${pkField}=${String(lr[loadPkIdx])}`);
				return;
			}
		}

		const rejections: string[] = [];
		for (const row of preview.rows) {
			const pk = row[pkIdx];
			if (pk === null || pk === undefined) {
				continue;
			}
			const pkStr = String(pk);
			const base = byPk.get(pkStr);
			if (!base) {
				rejections.push(`${pkField}=${pkStr}: row not found in ${collection}`);
			} else {
				const v = validateBulkMergeRow(zodSchema, base, patch);
				if (!v.ok) {
					rejections.push(`${pkField}=${pkStr}: ${v.message}`);
				}
			}
			if (rejections.length >= 12) {
				rejections.push("(further errors omitted)");
				break;
			}
		}
		if (rejections.length > 0) {
			setError(`Bulk merge rejected - would not satisfy schema:\n${rejections.join("\n")}`);
			return;
		}

		// One synthetic merge op per row; Drafts expands to deep JSON Patch ops at apply-time.
		let n = 0;
		for (const row of preview.rows) {
			const pk = row[pkIdx];
			if (pk === null || pk === undefined) {
				continue;
			}
			// eslint-disable-next-line no-await-in-loop
			await addDraft({
				collection,
				label: `bulk merge ${pkField}=${String(pk)}`,
				// Path: /~pk-marker~/<field> so the Drafts page can expand it
				// at apply-time into real indices against the read JSON array.
				op: {
					op: "replace",
					path: `/~by-${pkField}~/${encodeURIComponent(String(pk))}/__merge__`,
					value: patch,
				},
			});
			n++;
		}
		setStaged((s) => s + n);
	}

	return (
		<div>
			<h2 className="page-title">Bulk edit</h2>
			<p className="page-subtitle">
				Write a SELECT that returns primary keys. Provide a JSON patch. Stage the result as
				drafts and review in the Drafts drawer before applying to disk.
			</p>

			<SqliteWorkspaceGate>
				<label className="form-label">SELECT (preview query)</label>
				<SqlEditor
					className="mb-2"
					onChange={(next) => {
						sqlRef.current = next;
						setSql(next);
					}}
					onRun={() => {
						void runPreview();
					}}
					schema={schema}
					value={sql}
				/>

				<div className="row g-2 mb-2">
					<div className="col-md-6">
						<label className="form-label">Target collection</label>
						<input
							className="form-control mono"
							onChange={(e) => setCollection(e.target.value)}
							value={collection}
						/>
					</div>
					<div className="col-md-6">
						<label className="form-label">Primary-key column in query</label>
						<input
							className="form-control mono"
							onChange={(e) => setPkField(e.target.value)}
							value={pkField}
						/>
					</div>
				</div>

				<label className="form-label">
					Merge patch (JSON object, nested keys merge by path)
				</label>
				<textarea
					className={`form-control mono mb-1 ${patchError ? "is-invalid" : ""}`}
					onChange={(e) => setPatchJson(e.target.value)}
					rows={4}
					spellCheck={false}
					value={patchJson}
				/>
				{patchError ? (
					<div className="invalid-feedback mb-2">{patchError}</div>
				) : (
					<div className="mb-2" />
				)}

				<div className="d-flex gap-2 mb-3">
					<button className="btn btn-outline-primary" onClick={() => void runPreview()}>
						Preview (Ctrl-Enter)
					</button>
					<button
						className="btn btn-warning"
						disabled={!preview || preview.rows.length === 0 || !!patchError}
						onClick={() => void stage()}
					>
						Stage {preview ? `${preview.rows.length} drafts` : ""}
					</button>
					{staged ? (
						<span className="align-self-center text-muted">Staged {staged} so far</span>
					) : null}
				</div>

				{error ? <div className="alert alert-danger mono">{error}</div> : null}

				{preview ? (
					<ResultTable
						expandedContent={
							patch
								? ({ columns, row }) => (
										<BulkRowDiff
											collection={collection}
											columns={columns}
											patch={patch}
											pkField={pkField}
											row={row}
										/>
									)
								: undefined
						}
						maxRows={200}
						result={preview}
						rowDetailMode="inline"
					/>
				) : null}
			</SqliteWorkspaceGate>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Diff preview for a single bulk-edit row.
// ---------------------------------------------------------------------------

function BulkRowDiff({
	columns,
	row,
	pkField,
	collection,
	patch,
}: {
	collection: string;
	columns: string[];
	patch: Record<string, unknown>;
	pkField: string;
	row: unknown[];
}) {
	const [docPair, setDocPair] = useState<{
		after: Record<string, unknown>;
		before: Record<string, unknown>;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		const pkIdx = columns.indexOf(pkField);
		const pkValue = pkIdx >= 0 ? String(row[pkIdx]) : null;
		if (!pkValue) {
			setErr(`Column "${pkField}" not found in query results.`);
			setLoading(false);
			return;
		}

		void fetchCollection(collection)
			.then((data) => {
				const current = (data as Record<string, unknown>[]).find(
					(r) => String(r[pkField]) === pkValue,
				);
				if (!current) {
					setErr(`No row found in ${collection} where ${pkField}=${pkValue}.`);
					return;
				}
				setDocPair({
					after: applyMergeToRow(current, patch),
					before: current,
				});
			})
			.catch((e) => {
				setErr(e instanceof Error ? e.message : String(e));
			})
			.finally(() => {
				setLoading(false);
			});
		// Only run once per (collection, pkField, pkValue) combination.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (loading) {
		return <div className="draft-diff-loading">Loading diff…</div>;
	}
	if (err) {
		return <div className="draft-diff-error">{err}</div>;
	}
	if (!docPair) {
		return <div className="draft-diff-loading">No diff available.</div>;
	}
	return (
		<SingleRowDocumentDiff
			after={docPair.after}
			before={docPair.before}
			collectionName={collection}
		/>
	);
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function useParsedPatch(json: string): [Record<string, unknown> | null, string | null] {
	const [state, setState] = useState<[Record<string, unknown> | null, string | null]>(() =>
		parsePatch(json),
	);

	useEffect(() => {
		setState(parsePatch(json));
	}, [json]);

	return state;
}

function parsePatch(json: string): [Record<string, unknown> | null, string | null] {
	try {
		const v = JSON.parse(json);
		if (v === null || typeof v !== "object" || Array.isArray(v)) {
			return [null, "Patch must be a JSON object."];
		}
		return [v as Record<string, unknown>, null];
	} catch (e) {
		return [null, e instanceof Error ? e.message : String(e)];
	}
}
