import express, { type Express, Router } from "express";
import { describe, expect, it } from "vitest";

import { getRouteTemplate } from "./route-template";

function makeReq(app: Express, method: string, url: string) {
	// Construct just enough of an Express Request for `getRouteTemplate` to
	// walk the app's router stack. We don't need a real HTTP server.
	return {
		app,
		method,
		originalUrl: url,
		url,
	} as unknown as Parameters<typeof getRouteTemplate>[0];
}

describe("getRouteTemplate", () => {
	it("returns a single-segment route template verbatim", () => {
		const app = express();

		app.get("/status", (_req, res) => res.send("ok"));

		expect(getRouteTemplate(makeReq(app, "GET", "/status"))).toBe("/status");
	});

	it("substitutes a param in a leaf route", () => {
		const app = express();

		app.get("/users/:userID", (_req, res) => res.send("ok"));

		expect(getRouteTemplate(makeReq(app, "GET", "/users/zkldi"))).toBe("/users/:userID");
	});

	it("masks a username that looks ordinary (the cardinality bug)", () => {
		const app = express();

		app.get("/u/:username", (_req, res) => res.send("ok"));

		// Different usernames must all collapse to the same label.
		const a = getRouteTemplate(makeReq(app, "GET", "/u/zkldi"));
		const b = getRouteTemplate(makeReq(app, "GET", "/u/someone-else"));

		expect(a).toBe("/u/:username");
		expect(b).toBe("/u/:username");
		expect(a).toBe(b);
	});

	it("reconstructs templates through deeply nested routers", () => {
		const app = express();
		const main = Router();
		const api = Router();
		const users = Router({ mergeParams: true });
		const scores = Router({ mergeParams: true });

		main.use("/api/v1", api);
		api.use("/users/:userID", users);
		users.use("/scores/:scoreID", scores);
		scores.get("/", (_req, res) => res.send("ok"));
		users.get("/profile", (_req, res) => res.send("p"));

		app.use("/", main);

		expect(getRouteTemplate(makeReq(app, "GET", "/api/v1/users/zkldi/scores/abc123"))).toBe(
			"/api/v1/users/:userID/scores/:scoreID",
		);

		expect(getRouteTemplate(makeReq(app, "GET", "/api/v1/users/zkldi/profile"))).toBe(
			"/api/v1/users/:userID/profile",
		);
	});

	it("ignores query strings", () => {
		const app = express();
		const api = Router();

		api.get("/users/:userID", (_req, res) => res.send("ok"));
		app.use("/api/v1", api);

		expect(getRouteTemplate(makeReq(app, "GET", "/api/v1/users/zkldi?include=games"))).toBe(
			"/api/v1/users/:userID",
		);
	});

	it("returns null when no route matches", () => {
		const app = express();

		app.get("/status", (_req, res) => res.send("ok"));

		expect(getRouteTemplate(makeReq(app, "GET", "/does/not/exist"))).toBeNull();
	});

	it("returns null when method does not match the route", () => {
		const app = express();

		app.get("/status", (_req, res) => res.send("ok"));

		expect(getRouteTemplate(makeReq(app, "POST", "/status"))).toBeNull();
	});

	it("walks past pass-through middleware to find the matching route", () => {
		const app = express();
		const api = Router();

		api.use((_req, _res, next) => next());
		api.use((_req, _res, next) => next());
		api.get("/status", (_req, res) => res.send("ok"));

		app.use("/api/v1", api);

		expect(getRouteTemplate(makeReq(app, "GET", "/api/v1/status"))).toBe("/api/v1/status");
	});

	it("collapses a route with multiple params into a stable template", () => {
		const app = express();
		const games = Router({ mergeParams: true });

		games.get("/:game/:playtype/scores/:scoreID", (_req, res) => res.send("ok"));
		app.use("/api/v1/games", games);

		const a = getRouteTemplate(makeReq(app, "GET", "/api/v1/games/iidx/SP/scores/abc1234"));
		const b = getRouteTemplate(makeReq(app, "GET", "/api/v1/games/bms/14K/scores/def5678"));

		expect(a).toBe("/api/v1/games/:game/:playtype/scores/:scoreID");
		expect(b).toBe(a);
	});

	it("does not mutate layer.path / layer.params (safe to call concurrently)", () => {
		const app = express();
		const api = Router();

		api.get("/users/:userID", (_req, res) => res.send("ok"));
		app.use("/api/v1", api);

		// Snapshot baseline state.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const stack = (app as any)._router.stack as Array<{
			params?: unknown;
			path?: string;
		}>;
		const beforePaths = stack.map((l) => l.path);
		const beforeParams = stack.map((l) => l.params);

		getRouteTemplate(makeReq(app, "GET", "/api/v1/users/zkldi"));

		expect(stack.map((l) => l.path)).toEqual(beforePaths);
		expect(stack.map((l) => l.params)).toEqual(beforeParams);
	});
});
