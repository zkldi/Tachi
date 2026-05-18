import type { ScoreImportJobData, ScoreImportWorkerReturns } from "#lib/score-import/worker/types";
import type { ImportTypes } from "tachi-common";

import { ACTION_ScoreImport } from "#actions/score-import";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import { log } from "#lib/log/log";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";

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

	const user = await GetUserWithID(data.userID);
	if (!user) {
		log.error(`Couldn't find user with ID ${data.userID} for import ${data.importID}.`);
		throw new Error(`Couldn't find user with ID ${data.userID} for import ${data.importID}.`);
	}

	log.debug(`Starting import ${data.importID}.`);
	try {
		await ACTION_ScoreImport(
			{ ip: null, acct: { id: user.id, username: user.username } },
			{
				importID: data.importID,
				importType: data.importType,
				userIntent: data.userIntent,
				"!parserArguments": data.parserArguments as Array<unknown>,
				skipStartTracking: true,
				omitImportTrackerFailureOn409: true,
			},
		);
		const importDocument = await LoadImportDocumentById(data.importID);
		if (!importDocument) {
			throw new Error(
				`Import ${data.importID} completed but the import document could not be loaded.`,
			);
		}
		return { success: true, ImportDocument: importDocument };
	} catch (e) {
		if (ExpectedErr.is(e)) {
			log.info(
				{ err: e, importID: data.importID },
				`Import ${data.importID} hit ExpectedErr (user fault): ${e.reason}`,
			);
			return {
				success: false,
				importID: data.importID,
				statusCode: e.code,
				description: e.reason,
			};
		}
		log.error(e, `Import ${data.importID} failed unexpectedly.`);
		throw e;
	}
}
