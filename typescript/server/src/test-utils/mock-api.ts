import { log } from "#lib/log/log";
import supertest from "supertest";

import server from "../server/server";

log.debug("Creating Mock Server Connection...");
const connection = server.listen();

log.debug("Connecting to Supertest...");
const mockApi = supertest(connection);

/**
 * No-op. Many test files call this in their own `afterAll` to "close" the
 * supertest http.Server, but with `pool: "threads"` + `isolate: false`
 * (vitest.config.ts) a single listener is shared across every test file a
 * worker processes - a real `connection.close()` here would break every
 * subsequent file in the worker. Node tears the socket down on process exit,
 * which is sufficient for test mode. Kept exported for source compatibility
 * with the existing test suite.
 */
export function CloseServerConnection() {
	return Promise.resolve();
}

export default mockApi;
