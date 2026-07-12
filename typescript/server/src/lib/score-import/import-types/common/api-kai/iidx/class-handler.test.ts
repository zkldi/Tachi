import { log } from "#lib/log/log";
import { MockBasicFetch, MockJSONFetch } from "#test-utils/mock-fetch";
import { IIDX_DANS } from "tachi-common";
import { describe, expect, it } from "vitest";

import { KaiTypeToBaseURL } from "../utils";
import { CreateKaiIIDXClassProvider } from "./class-handler";

describe("CreateKaiIIDXClassProvider", () => {
	it("maps SP dan from the player profile", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: 18,
					dp: 4,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toStrictEqual({ dan: "KAIDEN" });
	});

	it("returns nothing if dan is not a number", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: "NOT A NUMBER",
					dp: 4,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing if dan is too great", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: IIDX_DANS.KAIDEN + 1,
					dp: 4,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing if dan is negative", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: IIDX_DANS.KYU_7 - 1,
					dp: 4,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing on HTTP errors", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockBasicFetch({ status: 500 }),
		);

		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("calls reauthFn on 401", async () => {
		let pass = false;
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				pass = true;
				return "";
			},
			MockBasicFetch({ status: 401 }),
		);

		fn("iidx-sp", 1, {}, log);

		expect(pass).toBe(true);
	});

	it("returns nothing when the requested side has null dans", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: 1,
					dp: null,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		const res = fn("iidx-dp", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("throws on non-iidx games (exhaustive switch)", async () => {
		const fn = await CreateKaiIIDXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/iidx/v2/player_profile`]: {
					_links: {},
					iidx_id: 12_345_678,
					dj_name: "SOMEONE",
					sp: 1,
					dp: 1,
					access_time: "2021-08-08T18:50:40Z",
					register_time: "2019-01-19T12:53:50Z",
				},
			}),
		);

		expect(() => fn("bms:14K" as never, 1, {}, log)).toThrow(/unreachable/u);
	});
});
