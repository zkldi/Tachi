import * as Comlink from "comlink";

import type { SqliteApi } from "./types";

// Lazy-singleton wrapping the SQLite worker. The worker file lives at
// ./worker.ts; Vite handles the `new Worker(new URL(...), { type: "module" })`
// idiom to emit it as a separate chunk.
let remote: Comlink.Remote<SqliteApi> | null = null;

export function getSqlite(): Comlink.Remote<SqliteApi> {
	if (remote) {
		return remote;
	}
	const worker = new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
		name: "seeds-webui-sqlite",
	});
	remote = Comlink.wrap<SqliteApi>(worker);
	void remote.init();
	return remote;
}
