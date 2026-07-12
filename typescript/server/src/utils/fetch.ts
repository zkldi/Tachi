import { Env } from "#lib/setup/config";
import nodeFetch, { type RequestInfo, type RequestInit, type Response } from "node-fetch";

const fetch =
	Env.NODE_ENV === "test"
		? () => {
				throw new Error("Cannot use real fetch inside testing env!");
			}
		: nodeFetch;

export type NodeFetch = (url: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;

export default fetch as unknown as NodeFetch;
