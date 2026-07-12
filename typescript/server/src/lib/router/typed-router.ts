import { log } from "#lib/log/log";
import { staticAssertUnreachable } from "#utils/misc";
import { ExpectedErr } from "bliss";
import { type Handler, type Request, type RequestHandler, type Response, Router } from "express";
import { type output, type ZodObject, type ZodTypeAny } from "zod";

/// Extract what params are available from the param string.
type ExtractPathParams<S extends string> = S extends `${string}:${infer Param}/${infer Rest}`
	? { [K in Param]: string } & ExtractPathParams<Rest>
	: S extends `${string}:${infer Param}`
		? { [K in Param]: string }
		: Record<never, never>;

export type RouteName = `${Method} ${string}`;
type Method = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type ExtractRouteParams<Route extends string> = Route extends `${Method} ${infer Path}`
	? ExtractPathParams<Path>
	: Record<never, never>;

export type MiddlewareFn = (req: Request) => Promise<Record<string, unknown>>;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
	x: infer I,
) => void
	? I
	: never;

type MergeCtx<M extends readonly MiddlewareFn[]> = [M[number]] extends [never]
	? Record<never, never>
	: UnionToIntersection<Awaited<ReturnType<M[number]>>>;

export interface RouteSpec {
	description: string;
	input: ZodObject;
	output: ZodTypeAny;
}

export type AnyRouterSpec = Record<RouteName, RouteSpec>;

export interface RouteData<
	TParams extends Record<string, string>,
	TInput,
	TCtx = Record<never, never>,
> {
	params: TParams;
	/**
	 * Parsed input. This is req.query for GET requests and req.body for everything else.
	 */
	input: TInput;
	ctx: TCtx;
	/** Escape hatch */
	req: Request;
	/** Escape hatch for handlers that must send their own response (e.g. redirects). */
	res: Response;
}

export interface ApiResponse<T> {
	success: true;
	description: string;
	body: T;
	/**
	 * Optional HTTP status code override. Defaults to 200.
	 * Stripped from the JSON response body before sending.
	 */
	$status?: number;
}

/** Returns a typed ApiResponse with status 200. */
export function success<T>(description: string, body: T): ApiResponse<T> {
	return { success: true, description, body };
}

/**
 * Wraps an Express RequestHandler as a TypedRouter MiddlewareFn.
 * Useful for adapting Express middleware (e.g. rate limiters) that call next().
 */
export function wrapExpressMiddleware(mw: RequestHandler): MiddlewareFn {
	return (req: Request) =>
		new Promise((resolve, reject) => {
			// req.res is set by Express internally on every request.
			mw(req, req.res!, (err?: unknown) => {
				if (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				} else {
					resolve({});
				}
			});
		});
}

type MaybePromise<T> = Promise<T> | T;

/** Type helper for declaring handlers in sub-files. */
export type RouteHandler<
	S extends AnyRouterSpec,
	Route extends keyof S & string,
	M extends readonly MiddlewareFn[] = readonly [],
> = (
	data: RouteData<
		ExtractRouteParams<Route>,
		output<(RouteSpec & S[Route])["input"]>,
		MergeCtx<M>
	>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
) => MaybePromise<ApiResponse<any>>;

type StoredEntry = {
	impl: (
		data: RouteData<Record<string, string>, unknown, unknown>,
	) => ApiResponse<unknown> | Promise<ApiResponse<unknown>>;
	middleware: readonly MiddlewareFn[];
};

export class TypedRouter<S extends AnyRouterSpec> {
	readonly #rawRoutes: Array<{
		args: Array<Handler>;
		method: "DELETE" | "GET" | "OPTIONS" | "PATCH" | "POST" | "PUT";
		route: string;
	}> = [];
	readonly #routes = new Map<string, StoredEntry>();
	readonly #spec: S;

	constructor(spec: S) {
		this.#spec = spec;
	}

	add<Route extends keyof S & string, M extends readonly MiddlewareFn[]>(
		route: Route,
		...args: [...M, RouteHandler<S, Route, M>]
	): this {
		if (this.#routes.has(route)) {
			throw new Error(`TypedRouter: "${route}" was registered twice.`);
		}

		const middleware = args.slice(0, -1) as unknown as readonly MiddlewareFn[];
		const impl = args[args.length - 1] as unknown as StoredEntry["impl"];

		this.#routes.set(route, { middleware, impl });

		return this;
	}

	build(): Router {
		const missing = (Object.keys(this.#spec) as (keyof S & string)[]).filter(
			(route) => !this.#routes.has(route),
		);

		if (missing.length > 0) {
			throw new Error(
				`TypedRouter.build(): missing implementations for:\n${missing.map((r) => `  - ${r}`).join("\n")}`,
			);
		}

		const router = Router({ mergeParams: true });

		for (const [route, { middleware, impl }] of this.#routes) {
			const spaceIdx = route.indexOf(" ");
			const method = route.slice(0, spaceIdx) as Method;
			const path = route.slice(spaceIdx + 1);

			const wrappedImpl = async (req: Request, res: Response) => {
				const ctxParts = await Promise.all(middleware.map((mw) => mw(req)));
				const ctx = Object.assign({}, ...ctxParts);

				const specEntry = this.#spec[route as keyof S] as RouteSpec;
				const input = method === "GET" ? req.query : req.safeBody;
				const parseResult = specEntry.input.safeParse(input);

				if (!parseResult.success) {
					throw new ExpectedErr(
						400,
						`Invalid request: ${parseResult.error.issues.map((i) => `${i.path} ${i.message}`).join(", ")}`,
					);
				}

				const result = await impl({
					params: req.params,
					input: parseResult.data,
					ctx,
					req,
					res,
				});

				// Allow handlers to send their own response (e.g. redirects, activity feeds).
				if (res.headersSent) {
					return;
				}

				const outputParseResult = specEntry.output.safeParse(result.body);

				if (!outputParseResult.success) {
					const zodErr = outputParseResult.error;
					const issueSummary = zodErr.issues
						.map((i) => {
							const pathStr = i.path.length > 0 ? i.path.join(".") : "(root)";
							return `${pathStr}: ${i.message}`;
						})
						.join("; ");

					log.error(
						{
							route,
							issues: zodErr.issues,
							returnedBody: result.body,
						},
						`TypedRouter: output validation failed for "${route}" (${issueSummary})`,
					);

					throw new Error(
						`TypedRouter: output validation failed for "${route}": ${issueSummary}`,
					);
				}

				const { $status, ...responseBody } = result;

				return res.status($status ?? 200).json(responseBody);
			};

			switch (method) {
				case "GET":
					router.get(path, wrappedImpl);
					break;
				case "POST":
					router.post(path, wrappedImpl);
					break;
				case "PUT":
					router.put(path, wrappedImpl);
					break;
				case "DELETE":
					router.delete(path, wrappedImpl);
					break;
				case "PATCH":
					router.patch(path, wrappedImpl);
					break;
				default:
					staticAssertUnreachable(method);
			}
		}

		for (const { method, route, args } of this.#rawRoutes) {
			switch (method) {
				case "DELETE":
					router.delete(route, ...args);
					break;
				case "GET":
					router.get(route, ...args);
					break;
				case "OPTIONS":
					router.options(route, ...args);
					break;
				case "PATCH":
					router.patch(route, ...args);
					break;
				case "POST":
					router.post(route, ...args);
					break;
				case "PUT":
					router.put(route, ...args);
					break;
				default:
					staticAssertUnreachable(method);
			}
		}

		return router;
	}

	rawAdd(
		method: "DELETE" | "GET" | "OPTIONS" | "PATCH" | "POST" | "PUT",
		route: string,
		...args: Array<Handler>
	) {
		this.#rawRoutes.push({
			method,
			route,
			args,
		});
	}
}
