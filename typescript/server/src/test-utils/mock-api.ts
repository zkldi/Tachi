import { log } from "#lib/log/log";
import supertest from "supertest";

import server from "../server/server";

// Signal to vitest.setup.ts that this worker has loaded mock-api so afterAll
// should call CloseServerConnection. Pure-unit test files that never touch
// the HTTP stack skip the import + close entirely - the close on a never-
// loaded mock-api was previously paying the full express router init tax in
// teardown (~2 s on cold workers).
(globalThis as { __tachi_mock_api_loaded?: boolean }).__tachi_mock_api_loaded = true;

log.debug("Creating Mock Server Connection...");
const connection = server.listen();

log.debug("Connecting to Supertest...");
const mockApi = supertest(connection);

/**
 * Historically test files have called this in their own `afterAll` to close
 * the supertest http.Server. With `pool: "threads"` + `isolate: false`
 * (vitest.config.ts) the same listener is shared across every test file a
 * worker processes, so doing a real `connection.close()` here would break
 * every subsequent file in the worker. Node tears the socket down on
 * process exit, so this is safe to no-op in test mode.
 */
export function CloseServerConnection() {
	return Promise.resolve();
}

export default mockApi;
