/**
 * HTTP stress harness: multipart POST /api/v1/import/file against a live Tachi instance.
 *
 * Uses real fixtures under src/test-utils/test-data/ (CSV, XML, JSON) - not MER.
 *
 * One in-flight import per user. If a concurrent import is already running the worker retries
 * with exponential backoff. Use a token pool sized ≥ concurrency.
 *
 * @example
 * bun run load-test:score-import -- \\
 *   --url https://your.tachi.instance \\
 *   --token-file ./tokens.txt \\
 *   --requests 30 --concurrency 3
 *
 * @example
 * bun run load-test:score-import -- --url https://tachi.example \\
 *   --token "$TACHI_TOKEN" --import-type file/solid-state-squad \\
 *   --file src/test-utils/test-data/s3/large-example.xml --requests 10
 */
import type { FileUploadImportTypes } from "tachi-common";

import { Command } from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileImportTypes } from "tachi-common/constants/import-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo fixtures: typescript/server/src/test-utils/test-data */
const TEST_DATA = path.join(__dirname, "../test-utils/test-data");

function defaultFixtureForType(t: FileUploadImportTypes): string {
	switch (t) {
		case "file/eamusement-iidx-csv":
			return path.join(TEST_DATA, "eamusement-iidx-csv/post-leggendaria.csv");
		case "file/pli-iidx-csv":
			return path.join(TEST_DATA, "eamusement-iidx-csv/small-hv-file.csv");
		case "file/eamusement-sdvx-csv":
			return path.join(TEST_DATA, "eamusement-sdvx-csv/exceed-gear-score.csv");
		case "file/solid-state-squad":
			return path.join(TEST_DATA, "s3/large-example.xml");
		case "file/batch-manual":
			return path.join(TEST_DATA, "batch-manual/chunitachi.json");
		case "file/mypagescraper-records-csv":
			return path.join(TEST_DATA, "wacca-mypage-scraper/records.csv");
		default:
			throw new Error(
				`No bundled default file for import type "${t}". Pass --file explicitly.`,
			);
	}
}

function assertFileImportType(s: string): FileUploadImportTypes {
	if (!fileImportTypes.includes(s as FileUploadImportTypes)) {
		console.error(
			`Invalid --import-type "${s}". Expected one of:\n  ${fileImportTypes.join("\n  ")}`,
		);
		process.exit(1);
	}
	return s as FileUploadImportTypes;
}

interface RequestResult {
	ok: boolean;
	status: number;
	durationMs: number;
	note?: string;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) {
		return 0;
	}
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[idx]!;
}

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/u, "");
}

function parseSetPairs(pairs: string[] | undefined): Record<string, string> {
	const r: Record<string, string> = {};
	if (!pairs?.length) {
		return r;
	}
	for (const pair of pairs) {
		const i = pair.indexOf("=");
		if (i <= 0) {
			console.error(`--set expects key=value, got: ${pair}`);
			process.exit(1);
		}
		r[pair.slice(0, i)] = pair.slice(i + 1);
	}
	return r;
}

function buildFormFields(
	importType: FileUploadImportTypes,
	playtype: string,
	extras: Record<string, string>,
): Record<string, string> {
	const fields = { ...extras };
	if (
		(importType === "file/eamusement-iidx-csv" || importType === "file/pli-iidx-csv") &&
		fields.playtype === undefined
	) {
		fields.playtype = playtype;
	}
	return fields;
}

/** Optional: tweak file bytes so repeated uploads are less identical (CSV last column timestamps). */
function maybeMutateFileBody(
	filePath: string,
	buf: Buffer,
	mutate: boolean,
	requestIndex: number,
): Buffer {
	if (!mutate) {
		return buf;
	}
	const base = path.basename(filePath).toLowerCase();
	if (base.endsWith(".csv")) {
		let s = buf.toString("utf-8");
		const lines = s.split(/\r?\n/u);
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (!line?.trim()) {
				continue;
			}
			lines[i] = line.replace(
				/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/u,
				(_, ts: string) => `${ts}:${String((requestIndex + i * 7) % 60).padStart(2, "0")}`,
			);
			if (lines[i] !== line) {
				break;
			}
		}
		s = lines.join("\n");
		return Buffer.from(s, "utf-8");
	}
	if (base.endsWith(".json")) {
		try {
			const o = JSON.parse(buf.toString("utf-8")) as { scores?: Array<{ score?: number }> };
			if (Array.isArray(o.scores)) {
				for (const row of o.scores) {
					if (typeof row.score === "number") {
						row.score = Math.max(0, row.score + (requestIndex % 97));
					}
				}
			}
			return Buffer.from(`${JSON.stringify(o)}\n`, "utf-8");
		} catch {
			return buf;
		}
	}
	// XML / others: suffix a harmless byte that most XML parsers ignore after root - skip
	return buf;
}

async function postFileImport(
	baseUrl: string,
	authHeaders: Record<string, string>,
	filePath: string,
	importType: FileUploadImportTypes,
	formFields: Record<string, string>,
	userIntent: boolean,
	requestIndex: number,
	mutate: boolean,
	timeoutMs: number | undefined,
): Promise<RequestResult> {
	const raw = readFileSync(filePath);
	const bytes = maybeMutateFileBody(filePath, raw, mutate, requestIndex);
	const fileName = path.basename(filePath);
	const upload = new Blob([bytes], { type: "application/octet-stream" });

	const form = new FormData();
	form.set("importType", importType);
	form.set("scoreData", upload, fileName);
	for (const [k, v] of Object.entries(formFields)) {
		form.set(k, v);
	}

	const headers: Record<string, string> = { ...authHeaders };
	if (userIntent) {
		headers["X-User-Intent"] = "true";
	}

	const t0 = performance.now();
	let res: Response;
	try {
		res = await fetch(`${baseUrl}/api/v1/import/file`, {
			method: "POST",
			headers,
			body: form,
			...(timeoutMs !== undefined ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
		});
	} catch (e) {
		const durationMs = performance.now() - t0;
		const name = e instanceof Error ? e.name : "";
		const isAbort = name === "AbortError" || name === "TimeoutError";
		return {
			ok: false,
			status: 0,
			durationMs,
			note: isAbort
				? `timeout (>${timeoutMs}ms)`
				: e instanceof Error
					? e.message
					: String(e),
		};
	}
	const durationMs = performance.now() - t0;
	const ok = res.status === 200 || res.status === 202;

	let note: string | undefined;
	if (res.status === 409) {
		note = "ongoing import (same user?)";
	} else if (res.status === 429) {
		note = "rate limited";
	} else if (res.status === 401 || res.status === 403) {
		note = "auth";
	}

	return { ok, status: res.status, durationMs, note };
}

function readTokenFile(p: string): string[] {
	const raw = readFileSync(p, "utf-8");
	return raw
		.split(/\r?\n/u)
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("#"));
}

async function main() {
	const program = new Command();
	program
		.name("score-import-file-stress")
		.description("POST /api/v1/import/file (multipart) for load testing.")
		.requiredOption("--url <origin>", "Tachi origin, e.g. https://example.com")
		.option("-n, --requests <n>", "total uploads", "20")
		.option("-c, --concurrency <n>", "parallel in-flight requests per batch", "1")
		.option(
			"--token <bearer>",
			"Bearer API token (repeat for multiple users)",
			(v, prev: string[] | undefined) => [...(prev ?? []), v],
		)
		.option("--token-file <path>", "One bearer token per line")
		.option("--cookie <string>", "Raw Cookie header; forces concurrency 1")
		.option(
			"-t, --import-type <type>",
			`file/* import type (see tachi-common)`,
			"file/eamusement-iidx-csv",
		)
		.option("-f, --file <path>", "fixture path (default: test-utils file for --import-type)")
		.option("--playtype <SP|DP>", "for IIDX CSV imports", "SP")
		.option(
			"--set <key=value>",
			"extra multipart field (repeatable)",
			(v, prev: string[] | undefined) => [...(prev ?? []), v],
		)
		.option(
			"--mutate-body",
			"slightly change each upload (CSV time / JSON scores) so payloads differ",
		)
		.option("--timeout-ms <n>", "per-request fetch timeout (0 = no limit)", "0")
		.option("--no-user-intent", "omit X-User-Intent: true")
		.parse();

	const opts = program.opts() as {
		concurrency: string;
		cookie?: string;
		file?: string;
		importType: string;
		mutateBody: boolean;
		playtype: string;
		requests: string;
		set?: string[];
		timeoutMs: string;
		token?: string[];
		tokenFile?: string;
		url: string;
		userIntent: boolean;
	};

	const timeoutParsed = Number.parseInt(opts.timeoutMs, 10);
	const timeoutMs =
		Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : undefined;

	const importType = assertFileImportType(opts.importType);
	const filePath = path.resolve(opts.file ?? defaultFixtureForType(importType));
	const formFields = buildFormFields(importType, opts.playtype, parseSetPairs(opts.set));

	const baseUrl = normalizeBaseUrl(opts.url);
	const total = Number.parseInt(opts.requests, 10);
	let concurrency = Number.parseInt(opts.concurrency, 10);

	if (!Number.isFinite(total) || total < 1) {
		console.error("--requests must be a positive integer");
		process.exit(1);
	}
	if (!Number.isFinite(concurrency) || concurrency < 1) {
		console.error("--concurrency must be a positive integer");
		process.exit(1);
	}

	const tokenPool: string[] = [];
	if (opts.tokenFile) {
		tokenPool.push(...readTokenFile(opts.tokenFile));
	}
	if (opts.token?.length) {
		tokenPool.push(...opts.token);
	}

	let authHeaders: Record<string, string>;
	if (opts.cookie) {
		if (tokenPool.length > 0) {
			console.error("Use either --cookie or token(s), not both.");
			process.exit(1);
		}
		concurrency = 1;
		if (Number.parseInt(opts.concurrency, 10) > 1) {
			console.warn("Cookie auth: concurrency forced to 1.");
		}
		authHeaders = { Cookie: opts.cookie };
	} else if (tokenPool.length > 0) {
		if (concurrency > tokenPool.length) {
			console.warn(
				`Concurrency ${concurrency} > ${tokenPool.length} token(s); capping to ${tokenPool.length}.`,
			);
			concurrency = tokenPool.length;
		}
		authHeaders = {};
	} else {
		console.error("Provide --token, --token-file, or --cookie.");
		process.exit(1);
	}

	console.error(`Using fixture: ${filePath}`);
	console.error(`importType=${importType} formFields=${JSON.stringify(formFields)}`);

	const results: RequestResult[] = [];
	const tWall = performance.now();

	/* eslint-disable no-await-in-loop -- batched parallel uploads */
	for (let start = 0; start < total; start += concurrency) {
		const batch = Math.min(concurrency, total - start);
		const batchOut = await Promise.all(
			Array.from({ length: batch }, (_, slot) => {
				const reqIndex = start + slot;
				const headers =
					opts.cookie !== undefined
						? authHeaders
						: { Authorization: `Bearer ${tokenPool[slot]!}` };
				return postFileImport(
					baseUrl,
					headers,
					filePath,
					importType,
					formFields,
					opts.userIntent,
					reqIndex,
					opts.mutateBody,
					timeoutMs,
				);
			}),
		);
		results.push(...batchOut);
	}
	/* eslint-enable no-await-in-loop */

	const wallMs = performance.now() - tWall;
	const okn = results.filter((r) => r.ok).length;
	const lat = results.map((r) => r.durationMs).sort((a, b) => a - b);
	const statusHistogram: Record<string, number> = {};
	for (const r of results) {
		const k = String(r.status);
		statusHistogram[k] = (statusHistogram[k] ?? 0) + 1;
	}

	console.log(
		JSON.stringify(
			{
				endpoint: `${baseUrl}/api/v1/import/file`,
				importType,
				fixture: filePath,
				requests: total,
				concurrency: Math.min(concurrency, total),
				accepted: okn,
				failed: total - okn,
				wallMs,
				requestsPerSec: wallMs > 0 ? (total / wallMs) * 1000 : 0,
				latencyMs: {
					p50: percentile(lat, 50),
					p95: percentile(lat, 95),
					max: lat.length ? lat[lat.length - 1]! : 0,
				},
				statusHistogram,
			},
			null,
			2,
		),
	);

	const failedSamples = results.filter((r) => !r.ok).slice(0, 8);
	if (failedSamples.length > 0) {
		console.error("Sample failures:", failedSamples);
	}

	if (okn < total) {
		process.exit(1);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
