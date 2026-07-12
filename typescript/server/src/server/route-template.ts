import { type Express, type Request, Router } from "express";

/**
 * Resolves the matched Express route *template* (e.g.
 * `/api/v1/users/:userID/scores/:scoreID`) for a given request.
 *
 * Used as the `path` label for Prometheus HTTP metrics so user-supplied path
 * parameters (usernames, score IDs, slugs, hashes…) don't blow up label
 * cardinality. Without this, every distinct username would produce a new
 * timeseries.
 *
 * Approach:
 *   1. At module import time, monkey-patch `Router.use` and `Router.route`
 *      so every `Layer` retains the original path *template string* it was
 *      registered with. Express normally only keeps the compiled regex.
 *   2. At lookup time, walk the request's app router stack, calling each
 *      layer's regex against the remaining URL, and concatenate the stored
 *      templates of the layers that match.
 *
 * The patch is idempotent so multiple imports (test re-entry, hot reload)
 * are safe. The walker is read-only - it never mutates layer state - so
 * it's safe to call at any point in the request lifecycle, including from
 * an `on("finish")` handler that may interleave with other requests.
 */

const TEMPLATE_PATH = Symbol.for("tachi.routeTemplate.path");
const PATCHED = Symbol.for("tachi.routeTemplate.patched");

interface ExpressLayer {
	name: string;
	route?: {
		methods: Record<string, boolean | undefined>;
		path: string;
	};
	handle: ((...args: Array<unknown>) => void) & { stack?: Array<ExpressLayer> };
	regexp: { fast_slash?: boolean; fast_star?: boolean } & RegExp;
	[TEMPLATE_PATH]?: string;
}

interface InternalRouter {
	stack: Array<ExpressLayer>;
}

interface PatchableRouter {
	[PATCHED]?: boolean;
	use: (this: InternalRouter, ...args: Array<unknown>) => unknown;
	route: (this: InternalRouter, path: unknown) => unknown;
}

/**
 * `args[0]` may be: a path string, a regex, an array of paths, a handler
 * function (no path → default `/`), or an array of handlers. Mirrors the
 * dispatch in `express/lib/router/index.js`.
 */
function extractPathArg(args: Array<unknown>): string {
	if (args.length === 0) {
		return "/";
	}

	let arg: unknown = args[0];

	while (Array.isArray(arg) && arg.length > 0) {
		arg = arg[0];
	}

	if (typeof arg === "function") {
		return "/";
	}

	if (typeof arg === "string") {
		return arg;
	}

	// RegExp or anything else - stringify so we still get a stable label.
	return String(arg);
}

function patchRouterPrototype(): void {
	const routerProto = Router as unknown as PatchableRouter;

	if (routerProto[PATCHED] === true) {
		return;
	}

	routerProto[PATCHED] = true;

	const originalUse = routerProto.use;
	const originalRoute = routerProto.route;

	routerProto.use = function patchedUse(this: InternalRouter, ...args: Array<unknown>) {
		const beforeLen = this.stack.length;
		const result = (originalUse as (...a: Array<unknown>) => unknown).apply(this, args);
		const templatePath = extractPathArg(args);

		for (let i = beforeLen; i < this.stack.length; i++) {
			const layer = this.stack[i];

			if (layer) {
				layer[TEMPLATE_PATH] = templatePath;
			}
		}

		return result;
	};

	routerProto.route = function patchedRoute(this: InternalRouter, path: unknown) {
		const result = (originalRoute as (p: unknown) => unknown).call(this, path);
		const lastLayer = this.stack[this.stack.length - 1];

		if (lastLayer) {
			lastLayer[TEMPLATE_PATH] = typeof path === "string" ? path : String(path);
		}

		return result;
	};
}

// Apply the patch as a side effect of importing this module. This MUST run
// before any Router/app instances register handlers, otherwise the early
// layers won't carry template metadata. Importing this from `prometheus.ts`
// (which is loaded by `server.ts` before `router.ts`) guarantees ordering.
patchRouterPrototype();

/**
 * Returns the Express route template that matched this request, e.g.
 * `/api/v1/users/:userID/scores/:scoreID`, or `null` if no route matched
 * (404 before any leaf handler, OPTIONS preflight, etc.).
 *
 * Safe to call from `res.on("finish")` handlers - the walker never mutates
 * layer state.
 */
export function getRouteTemplate(req: Request): string | null {
	const app = req.app as Express | undefined;

	if (!app) {
		return null;
	}

	const router = (app as unknown as { _router?: InternalRouter })._router;

	if (!router?.stack) {
		return null;
	}

	const method = (req.method ?? "GET").toLowerCase();
	const rawUrl = req.originalUrl ?? req.url ?? "/";
	const path = rawUrl.split("?", 1)[0] ?? "/";

	return walkStack(router.stack, path, "", method);
}

function walkStack(
	layers: Array<ExpressLayer>,
	remaining: string,
	accumulated: string,
	method: string,
): string | null {
	for (const layer of layers) {
		const consumed = matchLayerReadOnly(layer, remaining);

		if (consumed === null) {
			continue;
		}

		if (layer.route) {
			const methods = layer.route.methods;

			if (methods[method] !== true && methods._all !== true) {
				continue;
			}

			const template = layer[TEMPLATE_PATH] ?? layer.route.path;

			return joinTemplate(accumulated, template);
		}

		const handle = layer.handle;

		if (typeof handle === "function" && Array.isArray(handle.stack)) {
			const mountTemplate = layer[TEMPLATE_PATH] ?? "/";
			const cleanMount = mountTemplate === "/" ? "" : mountTemplate;
			const newRemaining = remaining.slice(consumed.length) || "/";
			const result = walkStack(handle.stack, newRemaining, accumulated + cleanMount, method);

			if (result !== null) {
				return result;
			}
		}

		// Pass-through middleware (helmet, body parsers, etc.) just falls
		// through to the next layer without consuming any path.
	}

	return null;
}

/**
 * Mirrors `Layer.prototype.match` from `express/lib/router/layer.js` but
 * without writing back to `layer.path` / `layer.params`. Returns the
 * consumed prefix on match, or `null` on miss.
 */
function matchLayerReadOnly(layer: ExpressLayer, path: string): string | null {
	if (layer.regexp.fast_slash === true) {
		return "";
	}

	if (layer.regexp.fast_star === true) {
		return path;
	}

	const match = layer.regexp.exec(path);

	if (!match) {
		return null;
	}

	return match[0];
}

function joinTemplate(prefix: string, suffix: string): string {
	if (suffix === "" || suffix === "/") {
		return prefix === "" ? "/" : prefix;
	}

	return prefix + suffix;
}
