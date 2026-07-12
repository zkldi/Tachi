import type { NodeFetch } from "#utils/fetch";

import { log } from "#lib/log/log";
import { agta } from "#test-utils/misc";
import { MockBasicFetch, MockJSONFetch } from "#test-utils/mock-fetch";
import { describe, expect, it } from "vitest";

import { TraverseKaiAPI } from "./traverse-api";

const fakeAuth = "bar";

describe("TraverseKaiAPI", () => {
	it("traverses paginated _items", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: {
					_next: "http://url.com/sub?page=2",
				},
				_items: [1, 2, 3, 4],
			},
			"http://url.com/sub?page=2": {
				_links: {
					_next: null,
				},
				_items: [5, 6],
			},
		});

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		const elements = await agta(res);

		expect(elements).toStrictEqual([1, 2, 3, 4, 5, 6]);
	});

	it("throws when _next origin does not match base URL (SSRF guard)", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: {
					_next: "http://evil.com/sub?page=2",
				},
				_items: [1, 2, 3, 4],
			},
			"http://url.com/sub?page=2": {
				_links: {
					_next: null,
				},
				_items: [5, 6],
			},
		});
		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toMatchObject({
			statusCode: 500,
			message: "http://url.com returned invalid data.",
		});
	});

	it("rejects on invalid JSON", async () => {
		const mockKaiAPI = (() => ({ json: null })) as unknown as NodeFetch;
		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();
	});

	it("rejects when fetch throws", async () => {
		const mockKaiAPI = () => {
			throw new Error("Fake Request timeout...");
		};

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();
	});

	it("rejects on invalid _links shape", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: null,
			},
		});

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();

		const mockKaiAPI2 = MockJSONFetch({
			"http://url.com/sub": {
				_links: "foo",
			},
		});

		const res2 = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI2);

		await expect(agta(res2)).rejects.toBeDefined();
	});

	it("rejects on invalid _links._next type", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: {},
			},
		});

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();

		const mockKaiAPI2 = MockJSONFetch({
			"http://url.com/sub": {
				_links: {
					_next: {},
				},
			},
		});

		const res2 = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI2);

		await expect(agta(res2)).rejects.toBeDefined();
	});

	it("rejects when _items is not an array", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: {
					_next: null,
				},
				_items: {},
			},
		});

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();
	});

	it("rejects on pagination infinite loop", async () => {
		const mockKaiAPI = MockJSONFetch({
			"http://url.com/sub": {
				_links: {
					_next: "http://url.com/sub",
				},
				_items: [1, 2, 3, 4],
			},
		});

		const res = TraverseKaiAPI("http://url.com", "/sub", fakeAuth, log, null, mockKaiAPI);

		await expect(agta(res)).rejects.toBeDefined();
	});

	it("invokes reauth on 401 and still fails after retry cap", async () => {
		const mockKaiAPI = MockBasicFetch({ status: 401 });

		let hasAttemptedReauth = false;

		const res = TraverseKaiAPI(
			"http://url.com",
			"/sub",
			fakeAuth,
			log,

			async () => {
				hasAttemptedReauth = true;
				return "bar";
			},
			mockKaiAPI,
		);

		await expect(agta(res)).rejects.toBeDefined();

		expect(hasAttemptedReauth).toBe(true);
	});
});
