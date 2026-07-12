import { expressRequestMock } from "#test-utils/mock-request";
import { describe, expect, it } from "vitest";

import { ValidateIRClientVersion } from "./auth";

describe("ValidateIRClientVersion", () => {
	it("rejects unsupported client versions", async () => {
		const { res } = await expressRequestMock(ValidateIRClientVersion, {
			headers: {
				"X-TachiIR-Version": "1.2.0",
			},
		});

		const json = res._getJSONData();

		expect(res.statusCode).toBe(400);
		expect(json.success).toBe(false);
		expect(json.description).toMatch(/Invalid X-TachiIR-Version/u);
	});

	it("rejects missing client header", async () => {
		const { res } = await expressRequestMock(ValidateIRClientVersion, {});

		const json = res._getJSONData();

		expect(res.statusCode).toBe(400);
		expect(json.success).toBe(false);
		expect(json.description).toMatch(/Invalid X-TachiIR-Version/u);
	});

	it("accepts v2.0.0", async () => {
		const { res } = await expressRequestMock(ValidateIRClientVersion, {
			headers: {
				"X-TachiIR-Version": "v2.0.0",
			},
		});

		expect(res.statusCode).toBe(200);
	});
});
