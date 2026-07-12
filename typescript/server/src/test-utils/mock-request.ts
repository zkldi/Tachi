import type { NextFunction, Request, RequestHandler, Response } from "express";

import { EventEmitter } from "events";
import { createMocks, type MockResponse, type RequestOptions } from "node-mocks-http";

export const expressRequestMock = (
	callback: Array<RequestHandler> | RequestHandler,
	options: RequestOptions = {},
	decorators: Record<string, unknown> = {},
): Promise<{
	req: Request;
	request: Request;
	res: MockResponse<Response>;
	response: MockResponse<Response>;
}> => {
	if (typeof callback !== "function" && !Array.isArray(callback)) {
		throw new TypeError("callback must be a function or array of functions");
	}

	// if an array of callbacks is passed, make sure to shallow-clone the array
	// just so when we unshift through it we don't mutate the original.
	const callbacks = Array.isArray(callback) ? callback.slice(0) : [callback];

	if (callbacks.length === 0) {
		throw new TypeError("callback can't be an empty array");
	}

	const { req, res } = createMocks(options, { eventEmitter: EventEmitter });

	// append extra properties to request and response, à la middleware
	Object.assign(req, decorators);
	Object.assign(res, decorators);

	return new Promise((resolve, reject) => {
		const done = () => {
			resolve({ req, res, request: req, response: res });
		};

		const next: NextFunction = (err) => {
			// Calling the fallthrough function with a string may be valid:-
			// 1. Calling with 'route' will skip any remaining route callbacks
			// 2. Calling with 'router' will exit the router and 404
			const isBypass = typeof err === "string" && /^router?$/u.test(err);

			if (err && !isBypass) {
				reject(err);
			} else {
				const nextCb = callbacks.shift();

				if (nextCb) {
					nextCb(req, res, next);
				} else {
					done();
				}
			}
		};

		res.on("end", done);

		next();
	});
};
