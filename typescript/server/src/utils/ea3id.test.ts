import {
	EXT_CANNON_BALLERS,
	EXT_HEROIC_VERSE,
	MODEL_IIDX,
	MODEL_INFINITAS_2,
	MODEL_SDVX3_KONASTE,
	REV_2DXBMS,
	REV_NORMAL,
} from "#lib/constants/ea3id";
import { describe, expect, it } from "vitest";

import { ParseEA3SoftID } from "./ea3id";

describe("ParseEA3SoftID", () => {
	it("parses a valid IIDX soft ID built from constants", () => {
		const ver = `${MODEL_IIDX}:J:A:${REV_2DXBMS}:${EXT_CANNON_BALLERS}`;

		expect(ParseEA3SoftID(ver)).toEqual({
			model: MODEL_IIDX,
			dest: "J",
			spec: "A",
			rev: REV_2DXBMS,
			ext: EXT_CANNON_BALLERS,
		});
	});

	it("parses Infinitas 2 and SDVX Konaste-style IDs", () => {
		expect(
			ParseEA3SoftID(`${MODEL_INFINITAS_2}:J:A:${REV_NORMAL}:${EXT_HEROIC_VERSE}`),
		).toEqual({
			model: MODEL_INFINITAS_2,
			dest: "J",
			spec: "A",
			rev: REV_NORMAL,
			ext: EXT_HEROIC_VERSE,
		});

		expect(ParseEA3SoftID(`${MODEL_SDVX3_KONASTE}:J:A:${REV_NORMAL}:2024010100`)).toEqual({
			model: MODEL_SDVX3_KONASTE,
			dest: "J",
			spec: "A",
			rev: REV_NORMAL,
			ext: "2024010100",
		});
	});

	it("throws when the string does not split into exactly five components", () => {
		expect(() => ParseEA3SoftID("LDJ:J:A:Z")).toThrow(
			"Invalid Version Code. Had 4 components.",
		);

		expect(() => ParseEA3SoftID("LDJ:J:A:Z:2018091900:extra")).toThrow(
			"Invalid Version Code. Had 6 components.",
		);
	});

	it("throws when the full string does not match the EA3 format", () => {
		expect(() =>
			ParseEA3SoftID(`${MODEL_IIDX}:J:A:${REV_2DXBMS}:${EXT_CANNON_BALLERS}x`),
		).toThrow("Invalid Version Code.");

		expect(() => ParseEA3SoftID(`ldj:J:A:${REV_2DXBMS}:${EXT_CANNON_BALLERS}`)).toThrow(
			"Invalid Version Code.",
		);

		expect(() => ParseEA3SoftID(`XX:J:A:${REV_2DXBMS}:${EXT_CANNON_BALLERS}`)).toThrow(
			"Invalid Version Code.",
		);

		expect(() => ParseEA3SoftID(`${MODEL_IIDX}:J:A:${REV_2DXBMS}:201809190`)).toThrow(
			"Invalid Version Code.",
		);
	});
});
