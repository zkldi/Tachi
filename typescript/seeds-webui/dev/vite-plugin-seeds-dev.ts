import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
	getCommit,
	gitExec,
	listBranches,
	listCommits,
	showFileAt,
	statusPorcelain,
} from "./util/git";
import { applyPatch, type JsonPatch } from "./util/json-patch";

// vite-plugin-seeds-dev - mounts /__seeds/* dev-only endpoints against the
// local repo's db/seeds directory so the seeds-webui can:
//
//   - GET  /__seeds/ping              feature probe
//   - GET  /__seeds/collections       list *.json in db/seeds
//   - GET  /__seeds/branches          local git branches
//   - GET  /__seeds/commits           log entries affecting db/seeds (optionally ?file=)
//   - GET  /__seeds/commit?sha=...    details of a specific commit
//   - GET  /__seeds/collection?name=&rev=   full JSON of a collection at a rev (or disk)
//   - POST /__seeds/collection        apply JSON patch, re-sort, write
//   - POST /__seeds/sort              run sort-seeds.js
//   - GET  /__seeds/status            working-tree status
//   - POST /__seeds/tests/run         run seeds-scripts tests, stream (SSE)
//
// All endpoints are ONLY registered during `vite dev`. They never make it into
// the production bundle.

export interface SeedsDevPluginOptions {
	repoRoot: string;
}

export function seedsDevPlugin(opts: SeedsDevPluginOptions): Plugin {
	const seedsDir = path.join(opts.repoRoot, "db", "seeds");
	const seedsRepoRelPath = "db/seeds";
	const seedsScriptsDir = path.join(opts.repoRoot, "typescript", "seeds-scripts");

	return {
		name: "seeds-webui:dev",
		apply: "serve",
		configureServer(server: ViteDevServer) {
			server.middlewares.use("/__seeds", async (req, res) => {
				try {
					await handle(req, res, {
						repoRoot: opts.repoRoot,
						seedsDir,
						seedsRepoRelPath,
						seedsScriptsDir,
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					server.config.logger.error(`[seeds-webui] ${req.url ?? ""}: ${message}`);
					if (!res.headersSent) {
						res.statusCode = 500;
						res.setHeader("content-type", "application/json");
						res.end(JSON.stringify({ error: message }));
					}
				}
			});
		},
	};
}

interface Ctx {
	repoRoot: string;
	seedsDir: string;
	seedsRepoRelPath: string;
	seedsScriptsDir: string;
}

// ---------- Dispatcher ----------

async function handle(req: IncomingMessage, res: ServerResponse, ctx: Ctx) {
	const url = new URL(req.url ?? "/", "http://localhost");
	const method = (req.method ?? "GET").toUpperCase();
	// `req.url` on middleware is already stripped of the /__seeds prefix.
	const route = `${method} ${url.pathname.replace(/\/+$/u, "")}`;

	switch (route) {
		case "GET /ping":
		case "GET /":
			return respond(res, 200, { ok: true });

		case "GET /collections":
			return respond(res, 200, await listCollectionFiles(ctx));

		case "GET /branches":
			return respond(res, 200, await listBranches(ctx.repoRoot));

		case "GET /commits":
			return respond(
				res,
				200,
				await commitsHandler(ctx, {
					branch: url.searchParams.get("branch") ?? undefined,
					cursor: url.searchParams.get("cursor") ?? undefined,
					file: url.searchParams.get("file") ?? undefined,
				}),
			);

		case "GET /commit": {
			const sha = url.searchParams.get("sha");
			if (!sha) {
				return respond(res, 400, { error: "missing sha" });
			}
			return respond(res, 200, await getCommit(ctx.repoRoot, sha));
		}

		case "GET /collection": {
			const name = url.searchParams.get("name");
			const rev = url.searchParams.get("rev") ?? undefined;
			if (!name) {
				return respond(res, 400, { error: "missing name" });
			}
			return respond(res, 200, await readCollection(ctx, name, rev));
		}

		case "POST /collection": {
			const body = await readJson<{ name: string; patch: JsonPatch }>(req);
			await writeCollection(ctx, body.name, body.patch);
			return respond(res, 200, { ok: true });
		}

		case "POST /sort": {
			await runSort(ctx);
			return respond(res, 200, { ok: true });
		}

		case "GET /status":
			return respond(res, 200, await statusHandler(ctx));

		case "POST /tests/run":
			return streamProcess(res, ctx.seedsScriptsDir, "bash", ["./run-tests.sh"]);
	}

	return respond(res, 404, { error: `no seeds-webui dev route for ${route}` });
}

// ---------- Helpers ----------

function respond(res: ServerResponse, status: number, body: unknown) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
	const chunks: Buffer[] = [];
	for await (const c of req) {
		chunks.push(c as Buffer);
	}
	const raw = Buffer.concat(chunks).toString("utf-8");
	if (raw.length === 0) {
		return {} as T;
	}
	return JSON.parse(raw) as T;
}

// ---------- Endpoint handlers ----------

async function listCollectionFiles(ctx: Ctx): Promise<string[]> {
	const names = await fs.readdir(ctx.seedsDir);
	return names.filter((n) => n.endsWith(".json")).sort();
}

async function commitsHandler(
	ctx: Ctx,
	opts: { branch?: string; cursor?: string; file?: string },
): Promise<{
	commits: Awaited<ReturnType<typeof listCommits>>;
	nextCursor?: string;
}> {
	const skip = opts.cursor ? Number.parseInt(opts.cursor, 10) : 0;
	const limit = 30;
	const targetFile = opts.file ? `${ctx.seedsRepoRelPath}/${opts.file}` : ctx.seedsRepoRelPath;

	const commits = await listCommits(ctx.repoRoot, {
		branch: opts.branch,
		file: targetFile,
		limit,
		skip,
	});
	return {
		commits,
		nextCursor: commits.length === limit ? String(skip + limit) : undefined,
	};
}

async function readCollection(ctx: Ctx, name: string, rev?: string): Promise<unknown[]> {
	validateCollectionName(name);
	if (rev === undefined) {
		const raw = await fs.readFile(path.join(ctx.seedsDir, name), "utf-8");
		return JSON.parse(raw) as unknown[];
	}
	validateRev(rev);
	const raw = await showFileAt(ctx.repoRoot, rev, `${ctx.seedsRepoRelPath}/${name}`);
	return JSON.parse(raw) as unknown[];
}

async function writeCollection(ctx: Ctx, name: string, patch: JsonPatch): Promise<void> {
	validateCollectionName(name);
	const file = path.join(ctx.seedsDir, name);
	const raw = await fs.readFile(file, "utf-8");
	const doc = JSON.parse(raw) as unknown[];
	const next = applyPatch(doc, patch);

	// Write atomically (same dir so it stays on the same fs).
	const tmp = `${file}.tmp-${process.pid}`;
	await fs.writeFile(tmp, JSON.stringify(next, null, "\t"));
	await fs.rename(tmp, file);

	// Re-run sort-seeds so diffs stay canonical.
	await runSort(ctx);
}

async function runSort(ctx: Ctx): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const proc = spawn("bun", ["./sort-seeds.js"], {
			cwd: ctx.seedsScriptsDir,
			stdio: "inherit",
		});
		proc.on("error", reject);
		proc.on("exit", (code) =>
			code === 0 ? resolve() : reject(new Error(`sort-seeds exited ${code}`)),
		);
	});
}

async function statusHandler(ctx: Ctx) {
	const s = await statusPorcelain(ctx.repoRoot);
	return {
		branch: s.branch,
		hasUncommittedChanges: s.changed.some((f) => f.startsWith(`${ctx.seedsRepoRelPath}/`)),
		changedFiles: s.changed.filter((f) => f.startsWith(`${ctx.seedsRepoRelPath}/`)),
	};
}

function streamProcess(
	res: ServerResponse,
	cwd: string,
	cmd: string,
	argv: string[],
): Promise<void> {
	return new Promise((resolve) => {
		res.statusCode = 200;
		res.setHeader("content-type", "text/event-stream");
		res.setHeader("cache-control", "no-cache");
		res.setHeader("x-accel-buffering", "no");

		const write = (kind: "stderr" | "stdout", data: string) => {
			res.write(`data: ${JSON.stringify({ kind, data })}\n\n`);
		};

		const proc = spawn(cmd, argv, { cwd });
		proc.stdout.on("data", (b: Buffer) => write("stdout", b.toString("utf-8")));
		proc.stderr.on("data", (b: Buffer) => write("stderr", b.toString("utf-8")));
		proc.on("error", (err) => write("stderr", `spawn error: ${err.message}\n`));
		proc.on("exit", (code) => {
			res.write(`data: ${JSON.stringify({ kind: "exit", code: code ?? -1 })}\n\n`);
			res.end();
			resolve();
		});
	});
}

// ---------- Validation ----------

function validateCollectionName(name: string): void {
	if (!/^[a-z0-9][a-z0-9-]*\.json$/u.test(name)) {
		throw new Error(`invalid collection name ${JSON.stringify(name)}`);
	}
}

// Allow branches, tags, shas, and short shas. Disallow shell metacharacters.
function validateRev(rev: string): void {
	if (!/^[A-Za-z0-9._/-]+$/u.test(rev)) {
		throw new Error(`invalid git revision ${JSON.stringify(rev)}`);
	}
}

// Re-export for the Vite config typecheck.
export type { JsonPatch };

// Used only in tests/dev to warm up git; exported so that callers can verify
// the repo is actually a git repo before mounting.
export async function gitSanityCheck(repoRoot: string): Promise<boolean> {
	try {
		await gitExec(repoRoot, ["rev-parse", "--git-dir"]);
		return true;
	} catch {
		return false;
	}
}
