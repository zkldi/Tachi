/// <reference lib="webworker" />
import sqlite3InitModule, { type Database, type SqlValue } from "@sqlite.org/sqlite-wasm";
import * as Comlink from "comlink";

import type { QueryResult, SqliteApi } from "./types";

import {
	ddlFor,
	type flavourFor,
	indexesFor,
	insertSqlFor,
	META_DDL,
	projectRow,
	tableNameFor,
} from "./schema";

// Single OPFS-backed database file. Versioned via SQLite's `user_version`
// pragma so future schema bumps can wipe cleanly.
//
// Bump history:
//   1  initial schema.
//   2  charts: PK changed from `chartID` to `id`, `legacyChartID` added.
//   3  folders/tables: PK changed to `id`, `legacyFolderID`/`legacyTableID`
//      added.
const DB_PATH = "/seeds-webui.sqlite3";
const SCHEMA_VERSION = 3;

let db: Database | null = null;

async function ensureDb(): Promise<Database> {
	if (db) {
		return db;
	}
	const sqlite3 = await sqlite3InitModule();

	if (typeof sqlite3.oo1.OpfsDb === "function") {
		// `OpfsDb` requires the page to be cross-origin isolated (COOP/COEP).
		// If it fails at construction time we fall through to a transient in-memory db.
		try {
			db = new sqlite3.oo1.OpfsDb(DB_PATH, "c");
		} catch (err) {
			console.warn("[seeds-webui] OPFS unavailable, falling back to :memory:", err);
			db = new sqlite3.oo1.DB(":memory:", "c");
		}
	} else {
		db = new sqlite3.oo1.DB(":memory:", "c");
	}

	initialise(db);
	return db;
}

function initialise(handle: Database) {
	handle.exec("PRAGMA journal_mode = MEMORY;");
	handle.exec("PRAGMA synchronous = NORMAL;");
	handle.exec(META_DDL);

	// Inspect the stored user_version. If it's older than what this build
	// expects, drop every non-meta table so the next ingest rebuilds them
	// from fresh DDL. Necessary because `CREATE TABLE IF NOT EXISTS` won't
	// modify an existing table's columns / PK.
	const current = selectAll(handle, "PRAGMA user_version;").rows[0]?.[0] as number | undefined;
	if (current === undefined || current < SCHEMA_VERSION) {
		console.info(
			`[seeds-webui] sqlite schema upgrade ${current ?? 0} -> ${SCHEMA_VERSION}; wiping cached tables`,
		);
		const tables = selectAll(
			handle,
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\'",
		);
		handle.exec("BEGIN");
		try {
			for (const [tbl] of tables.rows) {
				handle.exec(`DROP TABLE IF EXISTS "${tbl as string}"`);
			}
			handle.exec(`DELETE FROM _meta`);
			handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
			handle.exec("COMMIT");
		} catch (err) {
			handle.exec("ROLLBACK");
			throw err;
		}
	}
}

function selectAll(handle: Database, sql: string, params: readonly SqlValue[] = []): QueryResult {
	const t0 = performance.now();
	const stmt = handle.prepare(sql);
	try {
		if (params.length > 0) {
			stmt.bind(params);
		}
		const columns = stmt.getColumnNames();
		const rows: unknown[][] = [];
		while (stmt.step()) {
			rows.push(stmt.get([]) as unknown[]);
		}
		return { columns, elapsedMs: performance.now() - t0, rows };
	} finally {
		stmt.finalize();
	}
}

// SQLite only accepts scalar bindings; the UI hands us `unknown[]` so we
// coerce here (objects/arrays get JSON.stringified).
function toBindings(xs: unknown[]): SqlValue[] {
	return xs.map((v) => {
		if (v === undefined || v === null) {
			return null;
		}
		if (typeof v === "boolean") {
			return v ? 1 : 0;
		}
		if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
			return v;
		}
		if (v instanceof Uint8Array) {
			return v;
		}
		return JSON.stringify(v);
	});
}

const api: SqliteApi = {
	async init() {
		await ensureDb();
	},

	async ingest(name, rows, contentHash) {
		const handle = await ensureDb();
		const prev = selectAll(handle, `SELECT content_hash FROM _meta WHERE name = ?`, [name]);
		const prevHash = prev.rows[0]?.[0] as string | undefined;
		if (prevHash === contentHash) {
			return { ingested: false };
		}

		const tbl = tableNameFor(name);
		handle.exec("BEGIN");
		try {
			handle.exec(ddlFor(name));
			for (const idx of indexesFor(name)) {
				handle.exec(idx);
			}
			handle.exec(`DELETE FROM "${tbl}"`);
			const stmt = handle.prepare(insertSqlFor(name));
			try {
				for (const row of rows) {
					if (row === null || typeof row !== "object") {
						continue;
					}
					stmt.bind(toBindings(projectRow(name, row as Record<string, unknown>)));
					stmt.step();
					stmt.reset(true);
				}
			} finally {
				stmt.finalize();
			}
			handle.exec({
				bind: [name, contentHash, rows.length, Date.now()],
				sql: `INSERT OR REPLACE INTO _meta (name, content_hash, rows, ingested_at) VALUES (?, ?, ?, ?)`,
			});
			handle.exec("COMMIT");
		} catch (err) {
			handle.exec("ROLLBACK");
			throw err;
		}
		return { ingested: true };
	},

	async query(sql, params = []) {
		const handle = await ensureDb();
		return selectAll(handle, sql, toBindings(params));
	},

	async exec(sql, params = []) {
		const handle = await ensureDb();
		handle.exec({ bind: toBindings(params), sql });
		return { changes: 0 };
	},

	async tableCounts() {
		const handle = await ensureDb();
		const names = selectAll(
			handle,
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`,
		);
		const out: Array<{ name: string; rows: number }> = [];
		for (const [tbl] of names.rows) {
			const r = selectAll(handle, `SELECT COUNT(*) FROM "${tbl as string}"`);
			out.push({ name: tbl as string, rows: (r.rows[0]?.[0] ?? 0) as number });
		}
		return out;
	},

	async getSchema() {
		const handle = await ensureDb();
		const names = selectAll(
			handle,
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`,
		);
		const out: Record<string, string[]> = {};
		for (const [tbl] of names.rows) {
			const t = tbl as string;
			const info = selectAll(handle, `PRAGMA table_info("${t.replace(/"/gu, '""')}")`);
			const cols: string[] = [];
			for (const row of info.rows) {
				const name = row[1];
				if (typeof name === "string") {
					cols.push(name);
				}
			}
			out[t] = cols;
		}
		return out;
	},

	async getMeta() {
		const handle = await ensureDb();
		const r = selectAll(handle, `SELECT name, content_hash FROM _meta`);
		const out: Record<string, string> = {};
		for (const [n, h] of r.rows) {
			out[n as string] = h as string;
		}
		return out;
	},
};

// Silences unused-import on schema helpers that are referenced only inside
// the generated DDL strings.
export type __EnsureBundled = ReturnType<typeof flavourFor>;

Comlink.expose(api);
