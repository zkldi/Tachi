import type { z } from "zod";

import { mergeToPatchOps } from "#lib/edits/patch-merge-ops";
import { applyPatch, deepClone, type Operation } from "fast-json-patch";

/** Same merged document as apply-time JSON Patch expansion on a one-row array. */
export function mergedDocumentAfterBulkMerge(
	baseRow: Record<string, unknown>,
	patch: Record<string, unknown>,
): Record<string, unknown> {
	const doc = deepClone([baseRow]) as unknown[];
	const ops = mergeToPatchOps(baseRow, 0, patch) as Operation[];
	const { newDocument } = applyPatch(doc, ops, true, false);
	return newDocument[0] as Record<string, unknown>;
}

function formatZodIssues(err: z.ZodError): string {
	return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

export function validateBulkMergeRow(
	schema: z.ZodType<unknown>,
	baseRow: Record<string, unknown>,
	patch: Record<string, unknown>,
): { message: string; ok: false } | { ok: true } {
	try {
		const merged = mergedDocumentAfterBulkMerge(baseRow, patch);
		const r = schema.safeParse(merged);
		if (r.success) {
			return { ok: true };
		}
		return { message: formatZodIssues(r.error), ok: false };
	} catch (e) {
		return {
			message: e instanceof Error ? e.message : String(e),
			ok: false,
		};
	}
}
