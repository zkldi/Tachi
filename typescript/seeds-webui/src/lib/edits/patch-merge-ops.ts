import type { JsonPatchOp } from "#lib/transport/index";

export function jsonPtrEncode(s: string): string {
	return s.replace(/~/gu, "~0").replace(/\//gu, "~1");
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function hasLeafKey(doc: unknown, pathToLeaf: string[]): boolean {
	if (pathToLeaf.length === 0) {
		return false;
	}
	let cur: unknown = doc;
	for (let i = 0; i < pathToLeaf.length - 1; i++) {
		const s = pathToLeaf[i]!;
		if (!isPlainObject(cur) || !(s in cur)) {
			return false;
		}
		cur = cur[s];
	}
	const last = pathToLeaf[pathToLeaf.length - 1]!;
	return isPlainObject(cur) && last in cur;
}

export function getAtPath(doc: unknown, pathToLeaf: string[]): unknown {
	let cur: unknown = doc;
	for (const s of pathToLeaf) {
		if (!isPlainObject(cur)) {
			return undefined;
		}
		cur = cur[s];
	}
	return cur;
}

/** Deep merge `patch` into a shallow copy of `base` (plain objects merge recursively; scalars/arrays replace). */
export function applyMergeToRow(
	base: Record<string, unknown>,
	patch: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...base };
	for (const [k, v] of Object.entries(patch)) {
		if (isPlainObject(v) && isPlainObject(out[k])) {
			out[k] = applyMergeToRow(out[k] as Record<string, unknown>, v);
		} else {
			out[k] = v;
		}
	}
	return out;
}

/** Set or delete a value at a nested key path. Returns a deep-cloned object. */
export function setValueAtPath(
	doc: Record<string, unknown>,
	pathToLeaf: string[],
	value: unknown,
): Record<string, unknown> {
	if (pathToLeaf.length === 0) {
		return structuredClone(doc) as Record<string, unknown>;
	}
	const out = structuredClone(doc) as Record<string, unknown>;
	let cur: Record<string, unknown> = out;
	for (let i = 0; i < pathToLeaf.length - 1; i++) {
		const s = pathToLeaf[i]!;
		const next = cur[s];
		if (!isPlainObject(next)) {
			throw new Error("setValueAtPath: path crosses a non-object");
		}
		cur = cur[s] as Record<string, unknown>;
	}
	const last = pathToLeaf[pathToLeaf.length - 1]!;
	if (value === undefined) {
		// Keep behavior aligned with “missing key” in merge ops (caller usually passes a value).
		delete cur[last];
	} else {
		cur[last] = value;
	}
	return out;
}

/** Leaf paths for deep merge: plain objects recurse; arrays and other values are one op. */
export function flattenMergeLeaves(
	merge: Record<string, unknown>,
	prefix: string[],
): Array<{ path: string[]; value: unknown }> {
	const out: Array<{ path: string[]; value: unknown }> = [];
	for (const [k, v] of Object.entries(merge)) {
		const path = [...prefix, k];
		if (isPlainObject(v) && Object.keys(v).length > 0) {
			out.push(...flattenMergeLeaves(v, path));
		} else if (isPlainObject(v)) {
			// Empty object: no scalar to write at this branch.
		} else {
			out.push({ path, value: v });
		}
	}
	return out;
}

export function mergeToPatchOps(
	row: Record<string, unknown>,
	idx: number,
	patchObj: Record<string, unknown>,
): JsonPatchOp[] {
	const leaves = flattenMergeLeaves(patchObj, []);
	return leaves.map(
		({ path, value }) =>
			({
				op: hasLeafKey(row, path) ? "replace" : "add",
				path: `/${idx}/${path.map(jsonPtrEncode).join("/")}`,
				value,
			}) satisfies JsonPatchOp,
	);
}
