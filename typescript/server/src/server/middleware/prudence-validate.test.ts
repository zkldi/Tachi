import { expressRequestMock } from "#test-utils/mock-request";
import { p } from "prudence";
import { describe, expect, it } from "vitest";

import prValidate from "./prudence-validate";

describe("PrudenceMiddleware", () => {
	const mw = prValidate({ foo: p.regex(/^baz$/u) }, { foo: "example error message" });

	it("returns 400 on invalid prudence validation", async () => {
		const { res } = await expressRequestMock(mw, {
			query: {
				foo: "bar",
			},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData();

		expect(json.description).toBe("[foo] example error message (Received bar)");
	});

	it("returns 'nothing' instead of undefined for missing fields", async () => {
		const { res } = await expressRequestMock(mw, {
			query: {},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData();

		expect(json.description).toBe("[foo] example error message (Received nothing (undefined))");
	});

	it("allows valid prudence data", async () => {
		const { res } = await expressRequestMock(mw, {
			query: {
				foo: "baz",
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res._isJSON()).toBe(false);
	});

	it("allows valid bodies on non-GET requests", async () => {
		const { res } = await expressRequestMock(mw, {
			method: "POST",
			body: {
				foo: "baz",
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res._isJSON()).toBe(false);
	});

	it("returns 400 on invalid prudence validation for non-GET requests", async () => {
		const { res } = await expressRequestMock(mw, {
			method: "POST",
			body: {
				foo: "bar",
			},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData();

		expect(json.description).toBe("[foo] example error message (Received bar)");
	});

	const mwWithPassword = prValidate(
		{ "!password": "string" },
		{ "!password": "invalid password" },
	);

	it("does not return field contents when the key starts with !", async () => {
		const { res } = await expressRequestMock(mwWithPassword, {
			query: {
				"!password": 123,
			},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData();

		expect(json.description).toBe("[!password] invalid password (Received ****)");
	});

	it("obscures missing !-prefixed fields", async () => {
		const { res } = await expressRequestMock(mwWithPassword, {
			query: {
				"!password": undefined,
			},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData();

		expect(json.description).toBe(
			"[!password] invalid password (Received nothing (undefined))",
		);
	});
});
