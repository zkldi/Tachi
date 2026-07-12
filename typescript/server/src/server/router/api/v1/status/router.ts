import type { Request, Response } from "express";

import { CountQueuedJobs, GetActiveJobs } from "#lib/admin/admin-queries";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { VERSION_PRETTY } from "#lib/constants/version";
import {
	JOB_QUEUE_EVENTS_CHANNEL,
	WORKER_COUNT_REDIS_KEY,
	type WorkerPubSubEvent,
} from "#lib/jobs/job-queue/worker-pubsub";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { RedisClient } from "#services/redis/redis";
import { GetUserWithID } from "#utils/user";

import { API_V1_ROUTER } from "../_singleton";

const startTime = Date.now();

/**
 * Returns the current status of the Tachi Server.
 */
API_V1_ROUTER.add("GET /status", ({ input, req }) => {
	let echo;

	if (typeof input.echo === "string") {
		echo = input.echo;
	}

	return {
		success: true,
		description: "Status check successful.",
		body: {
			serverTime: Date.now(),
			startTime,
			version: VERSION_PRETTY,
			whoami: req[SYMBOL_TACHI_API_AUTH].userID,

			// converts {foo: true, bar: false, baz: true} into [foo, baz]
			permissions: Object.entries(req[SYMBOL_TACHI_API_AUTH].permissions)
				.filter((e) => e[1])
				.map((e) => e[0]),
			echo,
		},
	};
});

/**
 * Public SSE stream of live worker activity (active jobs, queue depth, worker count).
 *
 * @name GET /api/v1/status/worker-stream
 */
API_V1_ROUTER.rawAdd("GET", "/status/worker-stream", async (req: Request, res: Response) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders();

	function sendEvent(event: string, data: unknown): void {
		res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
	}

	const [activeJobs, queueDepth, workerCountRaw] = await Promise.all([
		GetActiveJobs(),
		CountQueuedJobs(),
		RedisClient.get(WORKER_COUNT_REDIS_KEY),
	]);
	const workerCount = workerCountRaw !== null ? parseInt(workerCountRaw, 10) : null;

	const userIDsInActiveJobs = [
		...new Set(
			activeJobs
				.map((j) => (j.payload as { userID?: number }).userID)
				.filter((id): id is number => typeof id === "number"),
		),
	];

	const usernameMap = new Map<number, string>();
	if (userIDsInActiveJobs.length > 0) {
		const users = await DB.selectFrom("account")
			.select(["account.id", "account.username"])
			.where("account.id", "in", userIDsInActiveJobs)
			.execute();
		for (const u of users) {
			usernameMap.set(u.id, u.username);
		}
	}

	const activeJobsEnriched = activeJobs.map((j) => {
		const p = j.payload as { importID?: string; importType?: string; userID?: number };
		return {
			jobId: j.row_id,
			userId: p.userID ?? null,
			username:
				p.userID !== undefined ? (usernameMap.get(p.userID) ?? String(p.userID)) : null,
			importType: p.importType ?? "unknown",
			importId: p.importID ?? "",
			startedAt: j.updated_at,
		};
	});

	sendEvent("snapshot", { activeJobs: activeJobsEnriched, queueDepth, workerCount });

	const subscriber = RedisClient.duplicate();

	subscriber.on("message", (_channel, message) => {
		void (async () => {
			let event: WorkerPubSubEvent;
			try {
				event = JSON.parse(message) as WorkerPubSubEvent;
			} catch {
				return;
			}

			try {
				if (event.type === "job:start") {
					const user = await GetUserWithID(event.userId);
					sendEvent("job:start", {
						...event,
						username: user?.username ?? String(event.userId),
					});
				} else if (event.type === "job:enqueued") {
					const depth = await CountQueuedJobs();
					sendEvent("queue:depth", { queueDepth: depth });
				} else {
					sendEvent(event.type, event);
				}
			} catch (err) {
				log.warn({ err }, "SSE worker-stream: error handling pub/sub event.");
			}
		})();
	});

	await subscriber.subscribe(JOB_QUEUE_EVENTS_CHANNEL);

	const keepalive = setInterval(() => {
		res.write(": keepalive\n\n");
	}, 25_000);

	req.on("close", () => {
		clearInterval(keepalive);
		subscriber.unsubscribe().catch(() => {});
		subscriber.disconnect();
	});
});

/**
 * Returns the current status of the Tachi Server, but as a POST
 * request, for that kind of testing.
 *
 * @name POST /api/v1/status
 */
API_V1_ROUTER.add("POST /status", ({ input, req }) => {
	let echo;

	if (typeof input.echo === "string") {
		echo = input.echo;
	}

	return {
		success: true,
		description: "Status check successful.",
		body: {
			serverTime: Date.now(),
			startTime,
			version: VERSION_PRETTY,
			whoami: req[SYMBOL_TACHI_API_AUTH].userID,

			// converts {foo: true, bar: false, baz: true} into [foo, baz]
			permissions: Object.entries(req[SYMBOL_TACHI_API_AUTH].permissions)
				.filter((e) => e[1])
				.map((e) => e[0]),
			echo,
		},
	};
});
