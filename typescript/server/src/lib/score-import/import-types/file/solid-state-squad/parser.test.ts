import { log } from "#lib/log/log";
import { MockMulterFile } from "#test-utils/mock-multer";
import { GetKTDataBuffer } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import type { S3Score } from "./types";

import { ParseSolidStateXML } from "./parser";

describe("ParseSolidStateXML", () => {
	it("parses simple valid S3 XML", () => {
		const res = ParseSolidStateXML(
			MockMulterFile(GetKTDataBuffer("./s3/valid.xml"), "valid.xml"),
			{},
			log,
		);

		expect(res.iterable as S3Score[]).toHaveLength(2);
		expect((res.iterable as S3Score[])[0]).toMatchObject({
			id: 187,
			diff: 7,
			songname: "GAMBOL",
			styles: "3rd",
			exscore: 100,
			scorebreakdown: {
				justgreats: 25,
				greats: 50,
				good: 0,
				bad: 0,
				poor: 4,
			},
			mods: {
				hardeasy: "H",
			},
			cleartype: "cleared",
			date: "2010-10-19 04:54:22",
		});
		expect((res.iterable as S3Score[])[1]).toMatchObject({
			id: 187,
			diff: "L7",
			songname: "GAMBOL",
			styles: "3rd",
			exscore: 100,
			scorebreakdown: {
				justgreats: 25,
				greats: 50,
				good: 0,
				bad: 0,
				poor: 4,
			},
			cleartype: "perfect",
			date: "2010-10-19 04:54:22",
		});
		expect(res.gameGroup).toBe("iidx");
		expect(res.classProvider).toBeNull();
		expect(res.context).toEqual({});
	});

	it("parses S3 XML with a single score", () => {
		const res = ParseSolidStateXML(
			MockMulterFile(GetKTDataBuffer("./s3/one-score.xml"), "one-score.xml"),
			{},
			log,
		);

		expect(res.iterable as S3Score[]).toHaveLength(1);
		expect((res.iterable as S3Score[])[0]).toMatchObject({
			id: 187,
			diff: 7,
			songname: "GAMBOL",
			styles: "3rd",
			exscore: 100,
			scorebreakdown: {
				justgreats: 50,
				greats: 50,
				good: 0,
				bad: 0,
				poor: 4,
			},
			cleartype: "perfect",
			date: "2010-10-19 04:54:22",
		});
		expect(res.gameGroup).toBe("iidx");
		expect(res.classProvider).toBeNull();
		expect(res.context).toEqual({});
	});

	it("parses .59 chart XML", () => {
		const res = ParseSolidStateXML(
			MockMulterFile(GetKTDataBuffer("./s3/point-five-nine.xml"), "point-five-nine.xml"),
			{},
			log,
		);

		expect(res.iterable as S3Score[]).toHaveLength(1);
		expect((res.iterable as S3Score[])[0]).toMatchObject({
			id: 187,
			diff: 7,
			songname: ".59",
			styles: "3rd",
			exscore: 100,
			scorebreakdown: {
				justgreats: 50,
				greats: 50,
				good: 0,
				bad: 0,
				poor: 4,
			},
			cleartype: "perfect",
			date: "2010-10-19 04:54:22",
		});
		expect(res.gameGroup).toBe("iidx");
		expect(res.classProvider).toBeNull();
		expect(res.context).toEqual({});
	});

	it("rejects XML with no scores", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(GetKTDataBuffer("./s3/no-score-data.xml"), "no-score-data.xml"),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML/u);
	});

	it("rejects invalid lamps", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(GetKTDataBuffer("./s3/invalid-lamp.xml"), "invalid-lamp.xml"),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML.*cleartype.*BAD LAMP/u);
	});

	it("rejects malicious mods", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(GetKTDataBuffer("./s3/malicious-mods.xml"), "malicious-mods.xml"),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML.*object.*1/u);
	});

	it("rejects malicious scorebreakdown", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(
					GetKTDataBuffer("./s3/malicious-scorebreakdown.xml"),
					"malicious-scorebreakdown.xml",
				),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML.*object.*1/u);
	});

	it("rejects invalid exscore", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(GetKTDataBuffer("./s3/invalid-exscore.xml"), "invalid-exscore.xml"),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML.*exscore.*positive integer.*-1/u);
	});

	it("rejects billion laughs expansion", () => {
		expect(() =>
			ParseSolidStateXML(
				MockMulterFile(
					GetKTDataBuffer("./s3/danger/billion-laughs.xml"),
					"billion-laughs.xml",
				),
				{},
				log,
			),
		).toThrow(/Invalid S3 XML/u);
	}, 5000);

	it("does not expand a specifically crafted payload", () => {
		const res = ParseSolidStateXML(
			MockMulterFile(
				GetKTDataBuffer("./s3/danger/specific-blaugh.xml"),
				"specific-blaugh.xml",
			),
			{},
			log,
		);

		expect((res.iterable as S3Score[])[0]?.songname).toBe("&lol9;");
	}, 5000);
});
