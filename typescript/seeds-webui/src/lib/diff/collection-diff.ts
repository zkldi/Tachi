/**
 * Per-collection diff: compare two document arrays (used by the Diff page
 * page) or a single before/after document pair (e.g. Drafts).
 */

import { prettySeedDocSummary } from "#lib/format/seed-doc-summary";

import { primaryKey, type Row, rowLabel } from "./row-primary-key";

export type { Row } from "./row-primary-key";
export { primaryKey, rowLabel } from "./row-primary-key";

// Deep-equality via JSON roundtrip. Good enough for seeds documents.
function sameJson(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	try {
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

export type FieldDelta =
	| { after: unknown; before: unknown; kind: "changed"; path: string }
	| { after: unknown; kind: "added"; path: string }
	| { before: unknown; kind: "removed"; path: string };

export function fieldDeltas(a: Row, b: Row, prefix = ""): FieldDelta[] {
	const out: FieldDelta[] = [];
	const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
	for (const k of keys) {
		const path = prefix ? `${prefix}.${k}` : k;
		const av = a?.[k];
		const bv = b?.[k];
		if (sameJson(av, bv)) {
			continue;
		}

		if (av === undefined) {
			out.push({ after: bv, kind: "added", path });
			continue;
		}
		if (bv === undefined) {
			out.push({ before: av, kind: "removed", path });
			continue;
		}
		// Recurse into plain objects (but not arrays - arrays are treated as
		// atomic scalar values, which is the right call for things like
		// `tierlistData` or chart `data`).
		if (
			typeof av === "object" &&
			typeof bv === "object" &&
			av !== null &&
			bv !== null &&
			!Array.isArray(av) &&
			!Array.isArray(bv)
		) {
			out.push(...fieldDeltas(av as Row, bv as Row, path));
			continue;
		}
		out.push({ after: bv, before: av, kind: "changed", path });
	}
	return out;
}

export type DiffRow =
	| { after: Row; before: Row; fields: FieldDelta[]; id: string; kind: "changed"; pretty: string }
	| { after: Row; id: string; kind: "added"; pretty: string }
	| { before: Row; id: string; kind: "removed"; pretty: string };

export interface DiffSummary {
	added: number;
	changed: number;
	removed: number;
	rows: DiffRow[];
}

export interface SummariseDiffContext {
	collectionName?: string;
	songById?: Map<string, Row> | null;
}

function prettyForRow(
	collectionName: string | undefined,
	doc: Row,
	songById: Map<string, Row> | null | undefined,
): string {
	if (!collectionName) {
		return rowLabel(doc);
	}
	return prettySeedDocSummary(collectionName, doc, { songById });
}

export function summariseDiff(a: unknown[], b: unknown[], ctx?: SummariseDiffContext): DiffSummary {
	const aMap = new Map<string, Row>();
	const bMap = new Map<string, Row>();
	for (const r of a) {
		const pk = primaryKey(r as Row);
		if (pk) {
			aMap.set(pk, r as Row);
		}
	}
	for (const r of b) {
		const pk = primaryKey(r as Row);
		if (pk) {
			bMap.set(pk, r as Row);
		}
	}

	let added = 0;
	let removed = 0;
	let changed = 0;
	const rows: DiffRow[] = [];
	const { collectionName, songById } = ctx ?? {};

	for (const [k, v] of bMap) {
		const prev = aMap.get(k);
		if (!prev) {
			added++;
			rows.push({
				after: v,
				id: k,
				kind: "added",
				pretty: prettyForRow(collectionName, v, songById),
			});
		} else if (!sameJson(prev, v)) {
			changed++;
			rows.push({
				after: v,
				before: prev,
				fields: fieldDeltas(prev, v),
				id: k,
				kind: "changed",
				pretty: prettyForRow(collectionName, v, songById),
			});
		}
	}
	for (const [k, v] of aMap) {
		if (!bMap.has(k)) {
			removed++;
			rows.push({
				before: v,
				id: k,
				kind: "removed",
				pretty: prettyForRow(collectionName, v, songById),
			});
		}
	}
	return { added, changed, removed, rows };
}

/**
 * One-row diff: before and/or after are full documents. Used when side-stepping
 * the primary-key index (e.g. a single draft op).
 */
export function singleDocumentDiff(
	before: Row | null,
	after: Row | null,
	ctx?: SummariseDiffContext,
): DiffRow | null {
	const { collectionName, songById } = ctx ?? {};

	if (before && !after) {
		return {
			before,
			id: rowLabel(before),
			kind: "removed",
			pretty: prettyForRow(collectionName, before, songById),
		};
	}
	if (!before && after) {
		return {
			after,
			id: rowLabel(after),
			kind: "added",
			pretty: prettyForRow(collectionName, after, songById),
		};
	}
	if (before && after) {
		if (sameJson(before, after)) {
			return null;
		}
		return {
			after,
			before,
			fields: fieldDeltas(before, after),
			id: rowLabel(before) || rowLabel(after),
			kind: "changed",
			pretty: prettyForRow(collectionName, after, songById),
		};
	}
	return null;
}

export function formatValue(v: unknown): string {
	if (v === undefined) {
		return "-";
	}
	if (v === null) {
		return "null";
	}
	if (typeof v === "string") {
		return v;
	}
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
}
