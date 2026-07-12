import { expressRequestMock } from "#test-utils/mock-request";
import { describe, expect, it } from "vitest";

import SanitiseQString from "./sanitise-qstring";

describe("SanitiseQString", () => {
	it("allows GET requests with valid data", async () => {
		const { res } = await expressRequestMock(SanitiseQString, {
			method: "GET",
			query: {
				foo: "bar",
			},
		});

		expect(res.statusCode).not.toBe(400);
	});

	it("disallows GET requests with nested data", async () => {
		const { res } = await expressRequestMock(SanitiseQString, {
			method: "GET",
			query: {
				foo: {
					bar: "baz",
				},
			},
		});

		expect(res.statusCode).toBe(400);
	});
});
