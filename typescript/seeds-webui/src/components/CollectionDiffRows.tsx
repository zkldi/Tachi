import type { Row } from "#lib/diff/row-primary-key";

import {
	type DiffRow,
	type FieldDelta,
	formatValue,
	singleDocumentDiff,
} from "#lib/diff/collection-diff";
import { useSongByIdLookup } from "#lib/format/use-song-by-id-lookup";
import { useMemo, useState } from "react";

export function SingleRowDocumentDiff({
	before,
	after,
	collectionName,
	songById: songByIdProp,
}: {
	after: Record<string, unknown> | null;
	before: Record<string, unknown> | null;
	/** When set, used for pretty titles (e.g. FormatChart). If omitted but `songById` is not passed, songs are loaded for `charts-*`. */
	collectionName?: string;
	songById?: Map<string, Row> | null;
}) {
	const shouldFetchSongs = Boolean(collectionName && songByIdProp === undefined);
	const songQuery = useSongByIdLookup(
		collectionName && shouldFetchSongs ? collectionName : undefined,
	);
	const songById = songByIdProp !== undefined ? songByIdProp : (songQuery.data ?? undefined);

	const row = useMemo(
		() => singleDocumentDiff(before, after, { collectionName, songById }),
		[before, after, collectionName, songById],
	);
	if (before === null && after === null) {
		return <div className="text-muted">No diff data.</div>;
	}
	if (!row) {
		return <div className="text-muted">No changes.</div>;
	}
	return <DiffRowCard row={row} />;
}

export function DiffRows({ rows, limit = 200 }: { limit?: number; rows: DiffRow[] }) {
	const visible = rows.slice(0, limit);
	const truncated = rows.length - visible.length;
	return (
		<div className="diff-list">
			{visible.map((r) => (
				<DiffRowCard key={r.id} row={r} />
			))}
			{truncated > 0 ? (
				<p className="text-muted">
					… {truncated.toLocaleString()} more rows hidden. Use the filter to narrow down.
				</p>
			) : null}
		</div>
	);
}

export function DiffRowCard({ row }: { row: DiffRow }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className={`diff-card diff-card-${row.kind}`}>
			<div className="diff-card-head">
				<span className={`diff-kind diff-kind-${row.kind}`}>
					{row.kind === "added" ? "+" : row.kind === "removed" ? "−" : "~"}
				</span>
				<code className="diff-id">{row.id}</code>
				{row.pretty !== row.id ? <span className="diff-pretty">{row.pretty}</span> : null}
				<span className="diff-card-spacer" />
				{row.kind === "changed" ? (
					<span className="diff-field-count">
						{row.fields.length} field
						{row.fields.length === 1 ? "" : "s"} changed
					</span>
				) : null}
				<button
					className="btn btn-sm btn-outline-secondary"
					onClick={() => setExpanded((x) => !x)}
					type="button"
				>
					{expanded ? "Hide JSON" : "Show JSON"}
				</button>
			</div>

			{row.kind === "changed" ? <FieldTable fields={row.fields} /> : null}

			{row.kind === "added" ? (
				<pre className="diff-json diff-json-added">{formatValue(row.after)}</pre>
			) : null}

			{row.kind === "removed" ? (
				<pre className="diff-json diff-json-removed">{formatValue(row.before)}</pre>
			) : null}

			{expanded && row.kind === "changed" ? (
				<div className="diff-json-pair">
					<div>
						<div className="diff-json-label">before</div>
						<pre className="diff-json diff-json-removed">{formatValue(row.before)}</pre>
					</div>
					<div>
						<div className="diff-json-label">after</div>
						<pre className="diff-json diff-json-added">{formatValue(row.after)}</pre>
					</div>
				</div>
			) : null}
		</div>
	);
}

function FieldTable({ fields }: { fields: FieldDelta[] }) {
	return (
		<table className="diff-fields">
			<thead>
				<tr>
					<th>Field</th>
					<th>Before</th>
					<th>After</th>
				</tr>
			</thead>
			<tbody>
				{fields.map((f) => (
					<tr className={`diff-fields-row diff-fields-row-${f.kind}`} key={f.path}>
						<td className="diff-fields-path mono">{f.path}</td>
						<td className="diff-fields-before">
							{f.kind === "added" ? (
								<span className="text-muted">-</span>
							) : (
								<pre className="mono">{formatValue(f.before)}</pre>
							)}
						</td>
						<td className="diff-fields-after">
							{f.kind === "removed" ? (
								<span className="text-muted">-</span>
							) : (
								<pre className="mono">{formatValue(f.after)}</pre>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
