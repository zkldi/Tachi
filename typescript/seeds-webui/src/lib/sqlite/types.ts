// Public types for the SQLite worker API.
//
// The worker runs an @sqlite.org/sqlite-wasm OO1 instance backed by OPFS.
// It exposes the tiny API in `SqliteApi` via Comlink; the main thread never
// touches the raw sqlite handle.

export interface SqliteApi {
	// Initialise the DB (open/create OPFS file, run DDL if missing).
	init(): Promise<void>;

	// Replace a collection's rows wholesale. Called by the builder after
	// fetching a JSON collection via the transport. Idempotent: matching
	// content_hash on _meta skips the work.
	ingest(name: string, rows: unknown[], contentHash: string): Promise<{ ingested: boolean }>;

	// Run a SELECT and return rows + column names.
	query(sql: string, params?: unknown[]): Promise<QueryResult>;

	// Run an INSERT/UPDATE/DELETE (for bulk-ops previews against a scratch DB).
	// Not persisted; the UI composes JSON patches separately and calls
	// transport.writeCollection for the real write.
	exec(sql: string, params?: unknown[]): Promise<{ changes: number }>;

	// Total row count per table.
	tableCounts(): Promise<Array<{ name: string; rows: number }>>;

	// Table name -> column names (from PRAGMA table_info), for query UI hints.
	getSchema(): Promise<Record<string, string[]>>;

	// Current manifest of (collection, contentHash) pairs we have ingested.
	// Used by the builder to decide what to re-ingest.
	getMeta(): Promise<Record<string, string>>;
}

export interface QueryResult {
	columns: string[];
	rows: unknown[][];
	// Elapsed wall-clock in the worker, ms.
	elapsedMs: number;
}
