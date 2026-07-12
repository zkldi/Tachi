import { log } from "#lib/log/log";
import { MockJSONFetch } from "#test-utils/mock-fetch";
import { describe, expect, it } from "vitest";

import { ParseKaiSDVX } from "./parser";

const fakeAuth = {
	userID: 1,
	refreshToken: "foo",
	service: "FLO" as const,
	token: "bar",
};

const NO_REAUTH = () => Promise.resolve("");

describe("ParseKaiSDVX", () => {
	it("iterates FLO play_history pages", async () => {
		const mockFloAPI = MockJSONFetch({
			"https://flo.example.com/api/sdvx/v1/play_history": {
				_links: {
					_next: "https://flo.example.com/api/sdvx/v1/play_history?page=2",
				},
				_items: [1, 2, 3, 4],
			},
			"https://flo.example.com/api/sdvx/v1/play_history?page=2": {
				_links: {
					_next: null,
				},
				_items: [5, 6],
			},
		});

		const res = await ParseKaiSDVX("FLO", fakeAuth, log, mockFloAPI, NO_REAUTH);

		expect(res.gameGroup).toBe("sdvx");
		expect(res.context).toStrictEqual({ service: "FLO" });

		const iter: Array<number> = [];

		for await (const el of res.iterable) {
			iter.push(el as number);
		}

		expect(iter).toStrictEqual([1, 2, 3, 4, 5, 6]);
	});

	it("iterates EAG play_history pages", async () => {
		const mockEagAPI = MockJSONFetch({
			"https://eag.example.com/api/sdvx/v1/play_history": {
				_links: {
					_next: "https://eag.example.com/api/sdvx/v1/play_history?page=2",
				},
				_items: [1, 2, 3, 4],
			},
			"https://eag.example.com/api/sdvx/v1/play_history?page=2": {
				_links: {
					_next: null,
				},
				_items: [5, 6],
			},
		});

		const res = await ParseKaiSDVX("EAG", fakeAuth, log, mockEagAPI, NO_REAUTH);

		expect(res.gameGroup).toBe("sdvx");
		expect(res.context).toStrictEqual({ service: "EAG" });

		const iter: Array<number> = [];

		for await (const el of res.iterable) {
			iter.push(el as number);
		}

		expect(iter).toStrictEqual([1, 2, 3, 4, 5, 6]);
	});
});
