import type { QueryResult } from "#lib/sqlite/types";

import { useMemo, useState } from "react";

// Threshold (in chars) above which a cell value is treated as a "blob" and
// gets its own scrollable monospace code box instead of an inline cell.
const LONG_VALUE_THRESHOLD = 80;

interface ResultTableProps {
	result: QueryResult;
	// Soft cap on rows rendered to keep the DOM cheap. Extra rows are counted
	// in the footer. Defaults to 500.
	maxRows?: number;
	// Optional footnote shown under the table (e.g. "first 500 of 1234 rows").
	footerNote?: React.ReactNode;
	// Optional renderer for trailing action buttons per row. Wrap interactive
	// elements in onClick={e => e.stopPropagation()} so they don't toggle row
	// expansion.
	rowActions?: (ctx: { columns: string[]; row: unknown[] }) => React.ReactNode;
	// If provided, replaces the default pretty-printed JSON expansion with
	// whatever this renders. In `toggle` mode, clicking the row shows/hides it.
	// In `inline` mode, the detail is always shown under each data row (no
	// expand column or click). Omit when you only have data rows.
	expandedContent?: (ctx: { columns: string[]; row: unknown[] }) => React.ReactNode;
	// `toggle` (default): chevron, click row to show detail. `inline`: always
	// show detail under each row when `expandedContent` is set; data rows are
	// not clickable. Used e.g. by Bulk to keep diffs visible without expanding.
	rowDetailMode?: "inline" | "toggle";
}

// Shared, readable result table. Used by Query and Bulk pages.
//
// Design notes:
//   - Cells wrap (`white-space: pre-wrap`) instead of ellipsising, so JSON
//     and long text are actually visible.
//   - Very long values get a scroll-capped code block, so one fat `raw`
//     column doesn't blow up row height.
//   - By default, clicking a row toggles a detail panel (see `rowDetailMode`).
//     Pass `expandedContent` for custom content (e.g. a diff); otherwise the
//     detail is the whole row as pretty-printed JSON.
//   - `rowDetailMode="inline"` (with `expandedContent`) shows that detail
//     under every row with no chevron or click - e.g. Bulk edit previews.
export function ResultTable({
	result,
	maxRows = 500,
	footerNote,
	rowActions,
	expandedContent,
	rowDetailMode = "toggle",
}: ResultTableProps) {
	const visible = result.rows.slice(0, maxRows);
	const hidden = result.rows.length - visible.length;
	const inline = rowDetailMode === "inline" && Boolean(expandedContent);

	// Heuristic: mark columns where any sampled value is long-ish as "wide",
	// so we render them as blobs instead of trying to squeeze them into a cell.
	const wideCols = useMemo(() => {
		const set = new Set<number>();
		const sample = visible.slice(0, 50);
		for (let col = 0; col < result.columns.length; col++) {
			for (const row of sample) {
				const v = row[col];
				if (typeof v === "string" && v.length > LONG_VALUE_THRESHOLD) {
					set.add(col);
					break;
				}
			}
		}
		return set;
	}, [visible, result.columns.length]);

	return (
		<div className="result-wrap">
			<div className="result-scroll">
				<table className="result-table-v2">
					<thead>
						<tr>
							{inline ? null : (
								<th aria-label="expand row" className="result-col-expand" />
							)}
							{result.columns.map((c, i) => (
								<th className={wideCols.has(i) ? "col-wide" : undefined} key={c}>
									{c}
								</th>
							))}
							{rowActions ? (
								<th aria-label="actions" className="result-col-actions" />
							) : null}
						</tr>
					</thead>
					<tbody>
						{visible.map((row, i) => (
							<ResultRow
								actions={rowActions}
								columns={result.columns}
								expandedContent={expandedContent}
								inlineDetail={inline}
								key={i}
								row={row}
								wideCols={wideCols}
							/>
						))}
					</tbody>
				</table>
			</div>
			{hidden > 0 ? (
				<div className="result-foot">
					Showing first {visible.length.toLocaleString()} of{" "}
					{result.rows.length.toLocaleString()} rows
				</div>
			) : null}
			{footerNote ? <div className="result-foot">{footerNote}</div> : null}
		</div>
	);
}

function ResultRow({
	row,
	columns,
	wideCols,
	actions,
	expandedContent,
	inlineDetail,
}: {
	actions?: (ctx: { columns: string[]; row: unknown[] }) => React.ReactNode;
	columns: string[];
	expandedContent?: (ctx: { columns: string[]; row: unknown[] }) => React.ReactNode;
	inlineDetail: boolean;
	row: unknown[];
	wideCols: Set<number>;
}) {
	const [open, setOpen] = useState(false);

	function toggle() {
		setOpen((x) => !x);
	}

	const extraCols = actions ? 1 : 0;
	const showPanel = inlineDetail || open;
	const isInline = inlineDetail;

	return (
		<>
			<tr
				className={isInline ? undefined : "result-row-clickable"}
				onClick={isInline ? undefined : toggle}
				onKeyDown={
					isInline
						? undefined
						: (e) => {
								if (e.key === "Enter" || e.key === " ") {
									toggle();
								}
							}
				}
				role={isInline ? undefined : "button"}
				tabIndex={isInline ? undefined : 0}
			>
				{isInline ? null : (
					<td className="result-col-expand">
						<span
							aria-label={open ? "Collapse row" : "Expand row"}
							className={`result-expander ${open ? "is-open" : ""}`}
						>
							▸
						</span>
					</td>
				)}
				{row.map((v, j) => (
					<ResultCell key={j} value={v} wide={wideCols.has(j)} />
				))}
				{actions ? (
					<td className="result-col-actions" onClick={(e) => e.stopPropagation()}>
						{actions({ columns, row })}
					</td>
				) : null}
			</tr>
			{showPanel ? (
				<tr
					className={
						isInline ? "result-expanded result-expanded-inline" : "result-expanded"
					}
				>
					{isInline ? null : <td aria-hidden="true" />}
					<td colSpan={columns.length + extraCols}>
						{expandedContent ? (
							expandedContent({ columns, row })
						) : (
							<pre className="result-row-json mono">
								{formatRowAsJson(row, columns)}
							</pre>
						)}
					</td>
				</tr>
			) : null}
		</>
	);
}

function ResultCell({ value, wide }: { value: unknown; wide: boolean }) {
	if (value === null) {
		return (
			<td>
				<em className="text-muted">NULL</em>
			</td>
		);
	}

	const str = typeof value === "string" ? value : String(value);
	const looksJson =
		typeof value === "string" && str.length > 2 && (str.startsWith("{") || str.startsWith("["));

	if (wide || str.length > LONG_VALUE_THRESHOLD || looksJson) {
		return (
			<td className="cell-blob">
				<pre className="cell-pre mono">{looksJson ? pretty(str) : str}</pre>
			</td>
		);
	}

	return <td>{str}</td>;
}

function pretty(s: string): string {
	try {
		return JSON.stringify(JSON.parse(s), null, 2);
	} catch {
		return s;
	}
}

function formatRowAsJson(row: unknown[], columns: string[]): string {
	const obj: Record<string, unknown> = {};
	for (let i = 0; i < columns.length; i++) {
		const k = columns[i]!;
		const v = row[i];
		if (typeof v === "string") {
			// If the value itself is a JSON string (like the `raw` column),
			// nest the parsed value so the row-json reads naturally.
			if (v.length > 2 && (v.startsWith("{") || v.startsWith("["))) {
				try {
					obj[k] = JSON.parse(v);
					continue;
				} catch {
					// fall through
				}
			}
			obj[k] = v;
		} else {
			obj[k] = v;
		}
	}
	return JSON.stringify(obj, null, 2);
}
