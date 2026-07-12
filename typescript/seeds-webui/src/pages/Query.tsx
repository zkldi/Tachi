import type { QueryResult } from "#lib/sqlite/types";

import { ResultTable } from "#components/ResultTable";
import { SchemaPanel } from "#components/SchemaPanel";
import { SqlEditor } from "#components/SqlEditor";
import { SqliteWorkspaceGate } from "#components/SqliteWorkspaceGate";
import { useIngest } from "#lib/ingest/IngestProvider";
import { getSqlite } from "#lib/sqlite/client";
import { useEffect, useRef, useState } from "react";

const SAMPLE = `SELECT
	level, COUNT(*) AS count
FROM
	charts_iidx_sp
GROUP BY
	level
ORDER BY
	count DESC
;`;

export function Query() {
	const { ready: sqliteReady } = useIngest();
	const [sql, setSql] = useState<string>(
		() => localStorage.getItem("seeds-webui:last-sql") ?? SAMPLE,
	);
	const sqlRef = useRef(sql);
	sqlRef.current = sql;
	const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
	const [showSchema, setShowSchema] = useState(true);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);

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

	async function run() {
		const text = sqlRef.current;
		setError(null);
		setRunning(true);
		try {
			const r = await getSqlite().query(text);
			setResult(r);
			localStorage.setItem("seeds-webui:last-sql", text);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className="sql-console">
			<h2 className="page-title">Query</h2>
			<p className="page-subtitle">
				Runs against the in-browser SQLite mirror of the seeds on disk. Read-only. Use
				Ctrl+Space in the editor for completions (tables, columns, keywords).
			</p>
			<SqliteWorkspaceGate>
				<div className="sql-editor-row mb-2">
					<div className="sql-editor-main">
						<SqlEditor
							className="mb-0"
							onChange={(next) => {
								sqlRef.current = next;
								setSql(next);
							}}
							onRun={() => {
								void run();
							}}
							schema={schema}
							value={sql}
						/>
					</div>
					{showSchema ? (
						<div className="schema-sidebar">
							<SchemaPanel schema={schema} />
						</div>
					) : null}
				</div>
				<div className="d-flex flex-wrap gap-2 mb-3">
					<button
						className="btn btn-primary"
						disabled={running}
						onClick={() => void run()}
					>
						{running ? "Running…" : "Run (Ctrl-Enter)"}
					</button>
					<button
						className="btn btn-outline-secondary"
						onClick={() => {
							setShowSchema((v) => !v);
						}}
						type="button"
					>
						{showSchema ? "Hide schema" : "Show schema"}
					</button>
					{result ? (
						<span className="text-muted align-self-center">
							{result.rows.length} rows · {result.elapsedMs.toFixed(1)} ms
						</span>
					) : null}
				</div>
				{error ? (
					<div className="alert alert-danger mono">{error}</div>
				) : result ? (
					<ResultTable result={result} />
				) : null}
			</SqliteWorkspaceGate>
		</div>
	);
}
