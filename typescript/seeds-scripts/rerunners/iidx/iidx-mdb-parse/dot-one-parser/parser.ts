import { log } from "#log";
import fs from "fs/promises";
import path from "path";
import { type integer } from "tachi-common";

import {
	type BGMObject,
	type BPMObject,
	type BSSObject,
	type CNObject,
	type EOCObject,
	type IIDXChartEvents,
	type IIDXParserContext,
	type IIDXParserOptions,
	type MeasureBarObject,
	type MeterObject,
	type NoteObject,
	type ParsedIIDXChart,
	type SampleObject,
	type ScratchObject,
	type TimingWindowsObject,
} from "./types";

interface EventParserContext {
	isDP?: boolean;
	songTitle?: string;
}

interface Directory {
	offset: number;
	length: number;
}

function ParseDirectoriesHeader(fileData: Buffer): Directory[] {
	// .1 format has 12 directory entries at the start
	// of the file.
	// these are all 8 bytes long, and all next to
	// eachother.
	const dirsBuffer = fileData.subarray(0, 12 * 8);

	const dirs: Array<{ length: integer; offset: integer }> = [];

	for (let i = 0; i < 12; i++) {
		const dirBuffer = dirsBuffer.subarray(i * 8, (i + 1) * 8);

		// the first 4 bytes indicate the offset
		// the other 4 indicate how many bytes
		// this chart takes up.
		const dir = {
			offset: dirBuffer.readIntLE(0, 4),
			length: dirBuffer.readIntLE(4, 4),
		};

		dirs.push(dir);
	}

	return dirs;
}

type Event =
	| { body: BGMObject; type: "BGM" }
	| { body: BPMObject; type: "BPM" }
	| { body: BSSObject; type: "BSS" }
	| { body: BSSObject; type: "HBSS" }
	| { body: CNObject; type: "CN" }
	| { body: CNObject; type: "HCN" }
	| { body: EOCObject; type: "EOC" }
	| { body: MeasureBarObject; type: "MEASUREBAR" }
	| { body: MeterObject; type: "METER" }
	| { body: NoteObject; type: "NOTE" }
	| { body: SampleObject; type: "SAMPLE" }
	| { body: ScratchObject; type: "SCRATCH" }
	| { body: TimingWindowsObject; type: "TIMINGWINDOW" };

const IIDX_TYPE_TO_RGC: Record<number, string> = {
	0: "NOTE",
	1: "NOTE",
	2: "SAMPLE",
	3: "SAMPLE",
	4: "BPM",
	5: "METER",
	6: "EOC",
	7: "BGM",
	8: "TIMINGWINDOW",
	12: "MEASUREBAR",
	13: "HCN_INDICATOR",
	16: "NOTECOUNT",
};

const IIDX_TIMING_TO_RGC: Record<
	number,
	"earlyBad" | "earlyGood" | "earlyGreat" | "lateBad" | "lateGood" | "lateGreat"
> = {
	0: "lateBad",
	1: "lateGood",
	2: "lateGreat",
	3: "earlyGreat",
	4: "earlyGood",
	5: "earlyBad",
};

function ParseEvent(
	noteData: Buffer,
	parseContext: EventParserContext,
	options: IIDXParserOptions,
): Event | null {
	const data = {
		ticks: noteData.readIntLE(0, 4),
		type: noteData.readIntLE(4, 1),
		param: noteData.readIntLE(5, 1),
		val: noteData.readIntLE(6, 2),
	};

	// A second EOF indicator (the real one) is that there is an event placed at -1 miliseconds.
	// return null, and DO NOT add this as an object.
	if (data.ticks < 0 || data.ticks >= 2147483647) {
		return null;
	}

	let type = IIDX_TYPE_TO_RGC[data.type];

	let event: Event;

	const ms = data.ticks * ((options.tickrate || 1000) / 1000);

	// Disambiguate NOTE type, which may indicate other RGC types.
	// THIS IS DIFFERENT TO THE IMMEDIATELY FOLLOWING STATEMENT!
	if (type === "NOTE") {
		// if val is nonzero, this note is a hold note
		// with ticks of (length);
		if (data.val !== 0) {
			type = options.isHellCharge ? "HCN" : "CN";
		}

		// scratch overrides
		if (data.param === 7) {
			// if hold on scratch column, we have BSS.
			if (data.val !== 0) {
				type = options.isHellCharge ? "HBSS" : "BSS";
			} else {
				type = "SCRATCH";
			}
		}
	}

	if (type === "NOTE") {
		const obj: NoteObject = {
			ms,
			col: data.param,
		};

		// if this note was on P2 side, we need to
		// add 7 to its column.
		if (data.type === 1) {
			obj.col += 7;
		}

		if (data.type === 1) {
			if (obj.col > 13 || obj.col < 0) {
				throw TypeError(`Invalid column of ${obj.col}. Must be between 0 and 13.`);
			}
		} else {
			if (obj.col > 6 || obj.col < 0) {
				throw TypeError(`Invalid column of ${obj.col}. Must be between 0 and 6.`);
			}
		}

		event = {
			type,
			body: obj,
		};
	} else if (type === "CN" || type === "HCN") {
		if (type === "CN" && options.errOnCN) {
			throw new TypeError(
				`CN found inside ${
					parseContext.songTitle || "UNKNOWN CHART"
				}, but errOnCN was enabled.`,
			);
		} else if (type === "HCN" && options.errOnHCN) {
			throw new TypeError(
				`HCN found inside ${
					parseContext.songTitle || "UNKNOWN CHART"
				}, but errOnHCN was enabled.`,
			);
		}

		const obj: CNObject = {
			ms,
			col: data.param,
			msEnd: data.val + ms,
		};

		if (data.type === 1) {
			obj.col += 7;
		}

		event = {
			type,
			body: obj,
		};
	} else if (type === "SCRATCH") {
		const obj: ScratchObject = {
			ms,
		};

		if (parseContext.isDP) {
			if (data.param === 7) {
				obj.col = 0;
			} else if (data.param === 14) {
				obj.col = 1;
			} else {
				return null;
			}
		}

		event = {
			type,
			body: obj,
		};
	} else if (type === "BSS" || type === "HBSS") {
		const obj: BSSObject = {
			ms,
			msEnd: ms + data.val,
		};

		if (parseContext.isDP) {
			if (data.param === 7) {
				obj.col = 0;
			} else if (data.param === 14) {
				obj.col = 1;
			} else {
				log.warn(
					`(${
						parseContext.songTitle ?? "UNKNOWN"
					}) Unknown column of scratchObj sent to EventParser: ${
						data.param
					}, expected 7 or 14. Skipping.`,
				);
				return null;
			}
		}

		event = {
			type,
			body: obj,
		};
	} else if (type === "SAMPLE") {
		const obj: SampleObject = {
			ms,
			col: data.param,
			sound: data.val,
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "BPM") {
		if (data.param === 0) {
			log.warn(
				`(${
					parseContext.songTitle ?? "UNKNOWN"
				}) Invalid value of 0 for denominator in BPM event (numerator was ${
					data.val
				}). Skipping.`,
			);
			return null;
		}

		const obj: BPMObject = {
			ms,
			bpm: data.val / data.param,
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "METER") {
		const obj: MeterObject = {
			ms,
			num: data.val,
			denom: data.param,
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "BGM") {
		const obj: BGMObject = {
			ms,
			pan: data.param,
			sound: data.val,
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "TIMINGWINDOW") {
		const window = IIDX_TIMING_TO_RGC[data.param];

		if (!window) {
			log.warn(
				`(${
					parseContext.songTitle ?? "UNKNOWN"
				}) Unknown type of timingWindow: ${window}, from .1 param ${data.param}. Skipping.`,
			);
			return null;
		}

		const obj: TimingWindowsObject = {
			ms,
			window,
			// for whatever reason, the value for TIMINGWINDOW is a signed int8,
			// rather than the int16 every other thing expects.
			// this means, suboptimally, we are reading noteData twice.
			// performance is hardly a concern though, as you can blast 100k
			// charts with this in a couple seconds.
			val: noteData.readIntLE(6, 1),
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "EOC") {
		const obj: EOCObject = {
			ms,
		};

		event = {
			type,
			body: obj,
		};
	} else if (type === "MEASUREBAR") {
		const obj: MeasureBarObject = {
			ms,
		};

		if (parseContext.isDP) {
			if (data.param !== 0 && data.param !== 1) {
				log.warn(
					`(${parseContext.songTitle ?? "UNKNOWN"}) Invalid parameter for measurebar of ${
						data.param
					}. Defaulting to 0 (left hand side).`,
				);
				obj.side = 0;
			} else {
				obj.side = data.param;
			}
		}

		event = {
			type,
			body: obj,
		};
	} else if (type === "NOTECOUNT") {
		// You might think: Hey! This is super convenient for just quickly getting
		// the notecount of a chart, right?
		// Well, uh, no. It's not correct. CNs are treated as one note, which is
		// *absolutely* not the case in game.
		// This thing is **utterly** useless, as you have to count the amount of CNs
		// anyway. At that point, why not count the notes?

		return null;
	} else if (type === "HCN_INDICATOR") {
		// this chart is using HCNs.
		options.isHellCharge = true;
		return null;
	} else if (data.type === 11) {
		// it's some sort of unknown BGA-related thing. Only seems to happen in older
		// charts. Maybe it was some sort of diverging bga instruction at one point?
		return null;
	} else {
		log.warn(
			`(${parseContext.songTitle ?? "UNKNOWN"}) Unknown event type in .1: ${
				data.type
			} at ${ms.toFixed(2)}ms. Ignoring.`,
		);
		return null;
	}

	return event;
}

function ParseEvents(
	fileData: Buffer,
	dir: Directory,
	context: EventParserContext,
	options: IIDXParserOptions,
) {
	const events: IIDXChartEvents = {
		BGM: [],
		BPM: [],
		BSS: [],
		HCN: [],
		CN: [],
		HBSS: [],
		NOTE: [],
		SAMPLE: [],
		METER: [],
		TIMINGWINDOW: [],
		MEASUREBAR: [],
		EOC: [],
		SCRATCH: [],
	};

	const data = fileData.subarray(dir.offset, dir.offset + dir.length);

	// charts are a series of 8 byte "events".
	// we are going to iterate through [data], pulling
	// said 8 bytes, and parsing them.
	// i am assuming that dir.length is always
	// a multiple of 8.
	for (let i = 0; i < dir.length; i += 8) {
		const noteBuffer = data.subarray(i, i + 8);

		const event = ParseEvent(noteBuffer, context, options);

		if (!event) {
			continue;
		}

		// @ts-expect-error invariant error but we're right.
		events[event.type].push(event.body);
	}

	return events;
}

/**
 * Converts the index of a directory to the corresponding difficulty name.
 */
const IIDX_DIFFICULTY_TO_RGC: Record<
	number,
	"ANOTHER" | "BEGINNER" | "HYPER" | "LEGGENDARIA" | "NORMAL" | null
> = {
	0: "HYPER",
	1: "NORMAL",
	2: "ANOTHER",
	3: "BEGINNER",
	4: "LEGGENDARIA", // ^^ SP ^^
	5: null, // vv DP vv
	6: "HYPER",
	7: "NORMAL",
	8: "ANOTHER",
	9: null,
	10: "LEGGENDARIA",
	11: null,
};

export function ParseDotOne(
	fileData: Buffer,
	context: IIDXParserContext = {},
	options: IIDXParserOptions = {},
) {
	const charts: Array<ParsedIIDXChart> = [];

	const dirs = ParseDirectoriesHeader(fileData);

	// with all our dirs we now need to parse each chart.
	for (let i = 0; i < 12; i++) {
		const dir = dirs[i];

		if (!dir || (dir.offset === 0 && dir.length === 0)) {
			log.debug(`Skipped directory ${i}, as there was no data.`);
			continue; // no data.
		}

		const difficulty = IIDX_DIFFICULTY_TO_RGC[i];

		if (!difficulty) {
			log.warn(
				`(${
					context.songTitle ?? "UNKNOWN"
				}) Data present inside directory ${i}, but this corresponds to an unknown difficulty. Ignoring.`,
			);
			continue;
		}

		const eventContext: EventParserContext = {
			isDP: i > 5,
			songTitle: context?.songTitle,
		};

		if (!eventContext.songTitle) {
			log.warn(
				"No filename provided in context.filename to IIDXParser, subsequent warnings will have no way of referring to the chart.",
			);
		}

		const events = ParseEvents(fileData, dir, eventContext, options);

		const chart: ParsedIIDXChart = {
			playtype: i > 5 ? "DP" : "SP",
			title: context?.songTitle ?? null,
			artist: context?.songArtist ?? null,
			genre: context?.genre ?? null,
			level: context?.level ?? null,
			marquee: context?.marquee ?? null,
			difficulty,
			notecount: getNotecount(events),
			events,
		};

		charts.push(chart);
	}

	return charts;
}

function getNotecount(events: IIDXChartEvents) {
	// note: account for HMSS at some point
	return (
		events.NOTE.length +
		events.SCRATCH.length +
		events.CN.length * 2 +
		events.HCN.length * 2 +
		events.BSS.length * 2 +
		events.HBSS.length * 2
	);
}

export async function ParseDotOneFile(
	filepath: string,
	context: IIDXParserContext = {},
	options: IIDXParserOptions = {},
) {
	const data = await fs.readFile(filepath);

	return ParseDotOne(data, context, options);
}

// if invoked as a script, parse the dotone and spit it out to debug.json.
if (require.main === module) {
	(async () => {
		const res = await ParseDotOneFile(process.argv.slice(2).join(" "));

		await fs.writeFile(path.join(__dirname, "debug.json"), JSON.stringify(res, null, "\t"));
	})();
}
