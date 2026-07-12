import { log } from "#lib/log/log";
import { describe, expect, it } from "vitest";

import { SoftwareIDToVersion } from "./parser";

describe("SoftwareIDToVersion", () => {
	const f = (sid: string) => SoftwareIDToVersion(sid, log);

	it("throws on invalid input", () => {
		expect(() => f("a")).toThrow();
		expect(() => f("LDJ:J:B:Q:2020092900")).toThrow();
		expect(() => f("LDJ:J:B:Q:2021091500")).toThrow();
		expect(() => f("XDJ:J:B:A:2020092900")).toThrow();
		expect(() => f("LDJ:J:B:A:2099092900")).toThrow();
	});

	it("maps known LDJ / TDJ software ids to display versions", () => {
		expect(f("LDJ:J:B:A:2020092900")).toBe("27");
		expect(f("LDJ:J:B:X:2020092900")).toBe("27-omni");
		expect(f("LDJ:J:B:E:2020092900")).toBe("27-2dxtra");
		expect(f("LDJ:J:B:A:2021091500")).toBe("28");
		expect(f("LDJ:J:B:X:2021091500")).toBe("28-omni");
		expect(f("LDJ:J:B:E:2021091500")).toBe("28-2dxtra");

		expect(f("TDJ:J:B:A:2020092900")).toBe("27");
		expect(f("TDJ:J:B:X:2020092900")).toBe("27-omni");
		expect(f("TDJ:J:B:E:2020092900")).toBe("27-2dxtra");
		expect(f("TDJ:J:B:A:2021091500")).toBe("28");
		expect(f("TDJ:J:B:X:2021091500")).toBe("28-omni");
		expect(f("TDJ:J:B:E:2021091500")).toBe("28-2dxtra");

		expect(f("P2D:J:B:A:2020092900")).toBe("inf");
	});
});
