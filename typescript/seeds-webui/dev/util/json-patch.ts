// Minimal JSON Patch (RFC 6902) applier limited to the three ops the UI emits:
// add, remove, replace. Paths use '/' separators; '-' as last segment on an
// array means "append".
//
// We deliberately do NOT depend on fast-json-patch here because this runs in
// the dev plugin (Node side) and we want zero Node-side dependencies beyond
// Vite itself.

export type JsonPatchOp =
	| { op: "add"; path: string; value: unknown }
	| { op: "remove"; path: string }
	| { op: "replace"; path: string; value: unknown };

export type JsonPatch = JsonPatchOp[];

type Json = unknown;

function decode(segment: string): string {
	return segment.replace(/~1/gu, "/").replace(/~0/gu, "~");
}

function split(path: string): string[] {
	if (path === "") {
		return [];
	}
	if (path[0] !== "/") {
		throw new Error(`Invalid JSON Pointer: ${path}`);
	}
	return path.slice(1).split("/").map(decode);
}

function isObj(v: unknown): v is Record<string, Json> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(
	root: Json,
	segments: string[],
): { exists: boolean; key: number | string; parent: Json } {
	if (segments.length === 0) {
		throw new Error(
			"Cannot address the root via a patch op here; edit the whole file instead.",
		);
	}
	let cur: Json = root;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i]!;
		if (Array.isArray(cur)) {
			const idx = Number(seg);
			if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
				throw new Error(
					`Array index out of bounds at ${segments.slice(0, i + 1).join("/")}`,
				);
			}
			cur = cur[idx];
		} else if (isObj(cur)) {
			if (!(seg in cur)) {
				throw new Error(`Missing key "${seg}" at ${segments.slice(0, i + 1).join("/")}`);
			}
			cur = cur[seg];
		} else {
			throw new Error(
				`Cannot descend into non-container at ${segments.slice(0, i + 1).join("/")}`,
			);
		}
	}
	const last = segments[segments.length - 1]!;
	if (Array.isArray(cur)) {
		const key = last === "-" ? cur.length : Number(last);
		if (last !== "-" && (!Number.isInteger(key) || key < 0 || key > cur.length)) {
			throw new Error(`Array index out of bounds at ${segments.join("/")}`);
		}
		return { parent: cur, key, exists: last !== "-" && key < cur.length };
	}
	if (isObj(cur)) {
		return { parent: cur, key: last, exists: last in cur };
	}
	throw new Error(`Cannot address ${segments.join("/")}: parent is not a container`);
}

export function applyPatch<T>(doc: T, patch: JsonPatch): T {
	const clone = JSON.parse(JSON.stringify(doc)) as T;
	for (const op of patch) {
		const segs = split(op.path);
		const { parent, key } = walk(clone, segs);
		if (Array.isArray(parent)) {
			const idx = key as number;
			switch (op.op) {
				case "add":
					parent.splice(idx, 0, op.value);
					break;
				case "remove":
					parent.splice(idx, 1);
					break;
				case "replace":
					parent[idx] = op.value;
					break;
			}
		} else if (isObj(parent)) {
			const k = key as string;
			switch (op.op) {
				case "add":
				case "replace":
					parent[k] = op.value;
					break;
				case "remove":
					delete parent[k];
					break;
			}
		}
	}
	return clone;
}
