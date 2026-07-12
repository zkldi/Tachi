import initSqlJs, { type BindParams, type Database, type SqlJsStatic } from "sql.js";
// Vite resolves this to a hashed static asset URL at build time
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

export type { Database as SqlJsDatabase };

/** Lazily initialise sql.js once, returning the cached promise on subsequent calls. */
export function getSqlJs(): Promise<SqlJsStatic> {
	if (!sqlJsPromise) {
		sqlJsPromise = initSqlJs({
			locateFile: () => sqlWasmUrl as string,
		});
	}
	return sqlJsPromise;
}

/** Open a SQLite database from a browser File object. */
export async function openDatabase(file: File): Promise<Database> {
	const SQL = await getSqlJs();
	const buffer = await file.arrayBuffer();
	return new SQL.Database(new Uint8Array(buffer));
}

/** Pull a single row from a query, returns null if nothing found. */
export function queryOne<T>(db: Database, sql: string, params: BindParams = []): T | null {
	const stmt = db.prepare(sql);
	stmt.bind(params);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as T;
	stmt.free();
	return row;
}

/** Pull all rows from a query. */
export function queryAll<T>(db: Database, sql: string, params: BindParams = []): T[] {
	const results: T[] = [];
	const stmt = db.prepare(sql);
	stmt.bind(params);
	while (stmt.step()) {
		results.push(stmt.getAsObject() as T);
	}
	stmt.free();
	return results;
}
