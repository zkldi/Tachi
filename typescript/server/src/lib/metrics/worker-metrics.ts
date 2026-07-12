import { log } from "#lib/log/log";
import http from "http";
import { collectDefaultMetrics, Registry } from "prom-client";

export interface WorkerMetrics {
	registry: Registry;
	/** Stops the HTTP listener. Safe to call more than once. */
	close: () => void;
}

/**
 * Start a bare HTTP server serving `GET /metrics` for Prometheus scraping.
 *
 * Only call this when `WORKER_METRICS_PORT` is explicitly set in env — workers
 * skip metrics in environments (e.g. local dev) where all processes share a host
 * and would conflict on the same port.
 *
 * Node.js default process metrics (`process_cpu_*`, `nodejs_heap_*`,
 * `nodejs_eventloop_lag_*`, etc.) are registered automatically. Custom metrics
 * can be added by the caller against the returned `registry`.
 */
export async function startWorkerMetricsServer(port: number): Promise<WorkerMetrics> {
	const registry = new Registry();
	collectDefaultMetrics({ register: registry });

	const server = http.createServer((req, res) => {
		if (req.method === "GET" && req.url === "/metrics") {
			registry
				.metrics()
				.then((body) => {
					res.writeHead(200, { "Content-Type": registry.contentType });
					res.end(body);
				})
				.catch((err: unknown) => {
					log.error(err, "Failed to collect metrics.");
					res.writeHead(500);
					res.end();
				});
		} else {
			res.writeHead(404);
			res.end();
		}
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, resolve);
	});

	log.info({ bootInfo: true }, `Worker metrics listening on port ${port} (/metrics).`);

	let closed = false;
	const close = () => {
		if (closed) {
			return;
		}
		closed = true;
		server.close();
	};

	return { registry, close };
}

/**
 * Parse `WORKER_METRICS_PORT` from env and start the metrics server if present.
 * Returns `null` when the env var is absent or not a valid integer ≥ 1.
 */
export async function maybeStartWorkerMetricsServer(
	env: Readonly<Record<string, string | undefined>>,
): Promise<WorkerMetrics | null> {
	const raw = env.WORKER_METRICS_PORT;
	if (!raw) {
		return null;
	}
	const port = Number.parseInt(raw, 10);
	if (Number.isNaN(port) || port < 1) {
		log.warn(`WORKER_METRICS_PORT "${raw}" is not a valid port, metrics disabled.`);
		return null;
	}
	return startWorkerMetricsServer(port);
}
