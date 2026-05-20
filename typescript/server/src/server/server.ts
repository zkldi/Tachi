import type { integer } from "tachi-common";

import "express-async-errors";
import express, { type Express } from "express";
// THIS IMPORT **MUST** GO HERE. DO NOT MOVE IT. IT MUST OCCUR BEFORE ANYTHING HAPPENS WITH EXPRESS
// BUT AFTER EXPRESS IS IMPORTED.

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import { Env, ServerConfig, TachiConfig } from "#lib/setup/config";
import { IsNonEmptyString, IsRecord } from "#utils/misc";
import { ExpectedErr } from "bliss";
import expressSession from "express-session";
import helmet from "helmet";

import { RequestLoggerMiddleware } from "./middleware/request-logger";
import { createPrometheusMiddlewares } from "./prometheus";
import mainRouter from "./router/router";

let store;

if (Env.NODE_ENV !== "test") {
	log.info({ bootInfo: true }, "Connecting ExpressSession to Redis.");
	// n.b. load bearing prefix here - do not remove the prefix for any reason.
	// Dynamic import keeps redis.ts (which uses Bun.RedisClient) out of the
	// module graph when running under Vitest's Node.js worker threads in tests.
	const [{ RedisClient }, { BunRedisSessionStore }] = await Promise.all([
		import("#services/redis/redis"),
		import("#services/redis/session-store"),
	]);
	store = new BunRedisSessionStore(RedisClient, { prefix: TachiConfig.NAME });
}

const userSessionMiddleware = expressSession({
	// append node_env onto the end of the session name
	// so we can separate tokens under the same URL.
	name: `${TachiConfig.NAME.replace(/ /gu, "_")}_SESSION`,
	secret: ServerConfig.SESSION_SECRET,
	store,
	resave: true,
	saveUninitialized: false,
	cookie: {
		secure: Env.NODE_ENV === "production" || Env.NODE_ENV === "staging",

		// Very important. Without this, we're vulnerable to CSRF!
		sameSite: Env.NODE_ENV === "production" || Env.NODE_ENV === "staging" ? "strict" : "lax",
	},
});

const app: Express = express();

/** When metrics are enabled, exposed only on `METRICS_PORT` as `GET /metrics` (not on the main HTTP port). */
export const metricsApp: Express | undefined = ServerConfig.ENABLE_METRICS ? express() : undefined;

app.get("/.deploy/up", (_req, res) => res.sendStatus(200));

if (Env.NODE_ENV !== "production" && IsNonEmptyString(ServerConfig.CLIENT_DEV_SERVER)) {
	log.warn(
		{
			bootInfo: true,
		},
		`Enabling CORS requests from ${ServerConfig.CLIENT_DEV_SERVER}.`,
	);

	// Note: we have to assign it here to make sure it doesn't get modified!
	// If we try and use ServerConfig.CLIENT_DEV_SERVER inside the callback, TS rightly
	// complains that this value might end up being mutated to null/undefined.
	//
	// Even though we don't do that,
	// we may aswell be correct about the whole thing.
	const clientDevServerLocation = ServerConfig.CLIENT_DEV_SERVER;

	// Allow CORS requests from another server (since we have our dev server hosted separately).
	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", clientDevServerLocation);
		res.header(
			"Access-Control-Allow-Headers",
			"Origin, X-Requested-With, Content-Type, Accept, X-User-Intent",
		);
		res.header("Access-Control-Allow-Credentials", "true");
		res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		next();
	});

	// hack to allow all OPTIONS requests. Remember that this setting should not be on in production!
	if (ServerConfig.OPTIONS_ALWAYS_SUCCEEDS === true) {
		app.options("*", (req, res) => res.send());
	}
} else {
	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "Content-Type, X-User-Intent, Authorization");
		res.header("Access-Control-Allow-Credentials", "false");
		res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		next();
	});

	app.options("*", (req, res) => res.send());

	if (Env.NODE_ENV !== "test") {
		log.info(
			{
				bootInfo: true,
			},
			"Enabling Helmet, as no CLIENT_DEV_SERVER was set, or we are in production.",
		);
	}

	app.use(helmet());
}

if (ServerConfig.ENABLE_METRICS && metricsApp) {
	for (const mw of createPrometheusMiddlewares(metricsApp)) {
		app.use(mw);
	}
}

app.use(userSessionMiddleware);

// Most of these options are leveraged from KTAPI

// Pass the IP of the user up our increasingly insane chain of nginx/docker nonsense
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

// we don't allow nesting in query strings.
app.set("query parser", "simple");

// taken from https://nodejs.org/api/process.html#process_event_unhandledrejection
// to avoid future deprecation.
process.on("unhandledRejection", (reason, promise) => {
	// @ts-expect-error reason is an error, and thelog can handle errors
	// it just refuses.
	log.error(reason, { promise });
});

process.on("uncaughtException", (err, origin) => {
	log.fatal({ err, origin }, "Uncaught exception, terminating.");
	log.flush(() => process.exit(1));
});

// enable reading json bodies
// limit them so as not to choke the api
app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
	// Always mount an empty req body. We operate under the assumption that req.body is
	// always defined as atleast an object.
	if (req.method !== "GET" && (typeof req.body !== "object" || req.body === null)) {
		req.body = {};
	}

	// req.safeBody *is* just a type-safe req.body!
	req.safeBody = req.body as Record<string, unknown>;

	next();
});

app.use(RequestLoggerMiddleware);

// Per-request timing for test-suite profiling. Enabled by TACHI_REQ_TIMING=1.
// Writes one line per request to stderr with method, url, status, total ms
// and an approximate "handler" budget (server-side time from middleware entry
// to res.on('finish')). Cheap enough to leave in for ad-hoc profiling but
// gated so it doesn't pollute the normal test log.
if (Env.NODE_ENV === "test" && process.env.TACHI_REQ_TIMING === "1") {
	app.use((req, res, next) => {
		const t0 = performance.now();
		res.on("finish", () => {
			const ms = performance.now() - t0;
			process.stderr.write(
				`[reqtiming] ${req.method.padEnd(4)} ${res.statusCode} ${ms.toFixed(1).padStart(7)}ms  ${req.originalUrl}\n`,
			);
		});
		next();
	});
}

app.use("/", mainRouter);

// completely stolen from ktapi error handler
interface ExpressJSONErr extends SyntaxError {
	status: integer;
	message: string;
}

const MAIN_ERR_HANDLER: express.ErrorRequestHandler = (err, req, res, _next) => {
	if (err instanceof SyntaxError) {
		const expErr: ExpressJSONErr = err as ExpressJSONErr;

		if (expErr.status === 400 && "body" in expErr) {
			log.info(
				{
					url: req.originalUrl,

					userID: req[SYMBOL_TACHI_API_AUTH]?.userID,
				},
				`JSON Parsing Error?`,
			);
			return res.status(400).send({ success: false, description: err.message });
		}

		// else, this isn't a JSON parsing error
	}

	// Action errors (ExpectedErr) carry an HTTP status code and a user-facing
	// reason. They are intentional control-flow throws and should not be logged
	// as fatal errors.
	if (ExpectedErr.is(err)) {
		return res.status(err.code).json({
			success: false,
			description: err.reason,
		});
	}

	log.error({ url: req.originalUrl, body: req.body }, `MAIN_ERR_HANDLER hit by request.`);

	const unknownErr = err as unknown;

	if (IsRecord(unknownErr) && unknownErr.type === "entity.too.large") {
		return res.status(413).json({
			success: false,
			description: "Your request body was too large. The limit is 4MB.",
		});
	}

	log.error(
		{
			err: unknownErr,
			url: req.originalUrl,
			authInfo: req[SYMBOL_TACHI_API_AUTH],
		},
		"Fatal error propagated to server root? ",
	);

	return res.status(500).json({
		success: false,
		description: "A fatal internal server error has occured.",
	});
};

app.use(MAIN_ERR_HANDLER);

export default app;
