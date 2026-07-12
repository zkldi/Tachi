import { log } from "#lib/log/log";
import { describe, expect, it } from "vitest";

import { CreateFerStaticClassProvider } from "./class-handler";

describe("CreateFerStaticClassProvider", () => {
	it("returns a class-provider function", () => {
		const res = CreateFerStaticClassProvider({ sp_dan: 1 });

		expect(typeof res).toBe("function");
	});

	it("returns nothing when no dans are set", () => {
		const res = CreateFerStaticClassProvider({})("iidx-sp", 1, {}, log);

		expect(res).toBeUndefined();
	});

	it("maps SP and DP dan indices to IIDX dan ids", () => {
		const fn = CreateFerStaticClassProvider({ sp_dan: 5, dp_dan: 7 });
		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toEqual({ dan: "KYU_2" });

		const res2 = fn("iidx-dp", 1, {}, log);

		expect(res2).toEqual({ dan: "DAN_1" });
	});

	it("skips invalid dan indices", () => {
		const fn = CreateFerStaticClassProvider({ sp_dan: -1, dp_dan: 100 });
		const res = fn("iidx-sp", 1, {}, log);

		expect(res).toBeUndefined();

		const res2 = fn("iidx-dp", 1, {}, log);

		expect(res2).toBeUndefined();
	});

	it("throws for non-IIDX games (unreachable guard)", () => {
		const fn = CreateFerStaticClassProvider({ sp_dan: 5, dp_dan: 7 });

		expect(() => fn("bms-7k" as any, 1, {}, log)).toThrow(/unreachable/u);
	});
});
