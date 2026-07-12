import { log } from "#lib/log/log";
import { MockBasicFetch, MockJSONFetch } from "#test-utils/mock-fetch";
import { SDVX_DANS } from "tachi-common";
import { describe, expect, it } from "vitest";

import { KaiTypeToBaseURL } from "../utils";
import { CreateKaiSDVXClassProvider } from "./class-handler";

describe("CreateKaiSDVXClassProvider", () => {
	it("maps skill_level to dan id", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/sdvx/v1/player_profile`]: {
					_links: {},
					sdvx_id: 12_345_678,
					name: "SOMEONE",
					skill_level: 10,
					access_time: "2019-08-26T18:22:36Z",
					register_time: "2019-08-26T18:22:36Z",
				},
			}),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({ dan: "DAN_10" });
	});

	it("returns nothing if dan is not a number", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/sdvx/v1/player_profile`]: {
					_links: {},
					sdvx_id: 12_345_678,
					name: "SOMEONE",
					skill_level: "NOT A NUMBER",
					access_time: "2019-08-26T18:22:36Z",
					register_time: "2019-08-26T18:22:36Z",
				},
			}),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing if dan is too great", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/sdvx/v1/player_profile`]: {
					_links: {},
					sdvx_id: 12_345_678,
					name: "SOMEONE",
					skill_level: SDVX_DANS.INF + 2,
					access_time: "2019-08-26T18:22:36Z",
					register_time: "2019-08-26T18:22:36Z",
				},
			}),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing if dan is negative", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/sdvx/v1/player_profile`]: {
					_links: {},
					sdvx_id: 12_345_678,
					name: "SOMEONE",
					skill_level: -1,
					access_time: "2019-08-26T18:22:36Z",
					register_time: "2019-08-26T18:22:36Z",
				},
			}),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("returns nothing on HTTP errors", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockBasicFetch({ status: 500 }),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({});
	});

	it("calls reauthFn on 401", async () => {
		let pass = false;
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				pass = true;
				return "";
			},
			MockBasicFetch({ status: 401 }),
		);

		fn("sdvx", 1, {}, log);

		expect(pass).toBe(true);
	});

	it("returns nothing when skill_level is null", async () => {
		const fn = await CreateKaiSDVXClassProvider(
			"FLO",
			"token",

			async () => {
				throw new Error(`Unexpectedly called reauthFn?`);
			},
			MockJSONFetch({
				[`${KaiTypeToBaseURL("FLO")}/api/sdvx/v1/player_profile`]: {
					_links: {},
					sdvx_id: 12_345_678,
					name: "SOMEONE",
					skill_level: null,
					access_time: "2019-08-26T18:22:36Z",
					register_time: "2019-08-26T18:22:36Z",
				},
			}),
		);

		const res = fn("sdvx", 1, {}, log);

		expect(res).toStrictEqual({});
	});
});
