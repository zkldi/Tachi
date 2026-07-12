import { expressRequestMock } from "#test-utils/mock-request";
import { describe, expect, it } from "vitest";

import { ValidateKaiType } from "./middleware";

describe("ValidateKaiType", () => {
	async function statusForKaiType(k: string) {
		const { res } = await expressRequestMock(ValidateKaiType, { params: { kaiType: k } });

		return res.statusCode;
	}

	it("allows flo, eag or min case-insensitively", async () => {
		expect(await statusForKaiType("flo")).toBe(200);
		expect(await statusForKaiType("eag")).toBe(200);
		expect(await statusForKaiType("min")).toBe(200);
		expect(await statusForKaiType("FLO")).toBe(200);
		expect(await statusForKaiType("EAG")).toBe(200);
		expect(await statusForKaiType("MIN")).toBe(200);
		expect(await statusForKaiType("FlO")).toBe(200);
		expect(await statusForKaiType("EaG")).toBe(200);
		expect(await statusForKaiType("MiN")).toBe(200);
	});

	it("rejects invalid kai types", async () => {
		expect(await statusForKaiType("nonsense")).toBe(400);
		expect(await statusForKaiType("bad")).toBe(400);
		expect(await statusForKaiType("")).toBe(400);
		expect(await statusForKaiType("FLO2")).toBe(400);
		expect(await statusForKaiType("2FLO")).toBe(400);
	});
});
