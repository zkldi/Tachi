import type { ScoreImportJobData, ScoreImportWorkerReturns } from "#lib/score-import/worker/types";
import type { ImportTypes } from "tachi-common";

import { log } from "#lib/log/log";

import { RunScoreImportOnce } from "./run-score-import";

export function jsonSerializeWithBuffers<T>(data: T): string {
	return JSON.stringify(data, (_k, v) => {
		if (Buffer.isBuffer(v)) {
			return { type: "Buffer" as const, data: Array.from(v as ArrayLike<number> & Buffer) };
		}
		return v;
	});
}

function decodeParserArguments(raw: Array<unknown>): Array<unknown> {
	const out: Array<unknown> = [];

	for (const arg of raw) {
		if (
			arg &&
			typeof arg === "object" &&
			(arg as { buffer?: { data?: number[]; type?: string } }).buffer?.type === "Buffer"
		) {
			const a = arg as { buffer: { data: number[] } };
			out.push({ ...a, buffer: Buffer.from(a.buffer.data) });
		} else {
			out.push(arg);
		}
	}
	return out;
}

/**
 * `payload` is JSONB from `job_queue` (object) or a JSON string.
 */
export async function processScoreImportJobFromPayload(
	payload: unknown,
): Promise<ScoreImportWorkerReturns> {
	const parsed: unknown =
		typeof payload === "string" ? (JSON.parse(payload) as unknown) : payload;
	const data = parsed as ScoreImportJobData<ImportTypes>;
	data.parserArguments = decodeParserArguments(
		data.parserArguments as Array<unknown>,
	) as ScoreImportJobData<ImportTypes>["parserArguments"];

	log.debug(`Starting import ${data.importID}.`);

	const result = await RunScoreImportOnce(data);

	switch (result.kind) {
		case "done":
			return { success: true, ImportDocument: result.importDoc };

		case "lock_held":
			// Signal the worker to requeue; no action was invoked so no audit row.
			return {
				success: false,
				importID: data.importID,
				statusCode: 409,
				description: "User already has an ongoing import.",
			};

		case "expected_err":
			log.info(
				{ importID: data.importID, statusCode: result.statusCode },
				`Import ${data.importID} hit ExpectedErr (user fault): ${result.description}`,
			);
			return {
				success: false,
				importID: data.importID,
				statusCode: result.statusCode,
				description: result.description,
			};
	}
}
