import { type integer } from "tachi-common";

export interface ChartObject {
	ms: number;
}

/**
 * Note Object: Indicates that there is a playable note here.
 * For SP, this goes from 0 to 6.
 * For DP, this goes from 0 to 13.
 */
export interface NoteObject extends ChartObject {
	col: number;
}

export interface ScratchObject extends ChartObject {
	col?: 0 | 1;
}

export interface CNObject extends NoteObject {
	msEnd: number;
}

export interface BSSObject extends ScratchObject {
	msEnd: number;
}

/**
 * Sample Object: Indicates that there is a sample (keysound) here.
 * Regardless of SP or DP, the game stores samples that can happen on
 * any of the 14 columns.
 */
export interface SampleObject extends ChartObject {
	col: number;
	sound: number;
}

/**
 * BGM Object: Indicates that there is a background sample here.
 * Unlike sample objects, these do not happen on columns, and instead use
 * their two parameters to express panning and sound.
 */
export interface BGMObject extends ChartObject {
	pan: number;
	sound: number;
}

/**
 * BPM Object: Indicates that there is a change of BPM here.
 * BPM is expected to be a float.
 */
export interface BPMObject extends ChartObject {
	bpm: number;
}

/**
 * Meter Object: Indicates that there is a change of time signature here.
 * Most charts never use this, but it does exist in a lot of old TaQ songs.
 * It is expected that num and denom are integers.
 */
export interface MeterObject extends ChartObject {
	num: number;
	denom: number;
}

/**
 * Measure Bar Object: Indicates that there is a measure bar here.
 * Unlike other games, IIDX has these baked into the chart format, presumably to allow for
 * charts such as 100%-minimoo G.
 * For some reason, this has an additional property which determines what
 * side it renders for.
 */
export interface MeasureBarObject extends ChartObject {
	side?: 0 | 1;
}

/**
 * End Of Chart object, Indicates that this is where the chart should end,
 * and the game should switch to fadeout / display splashes.
 */
export type EOCObject = ChartObject;

export interface TimingWindowsObject extends ChartObject {
	window: "earlyBad" | "earlyGood" | "earlyGreat" | "lateBad" | "lateGood" | "lateGreat";
	val: number;
}

export interface IIDXChartEvents {
	SAMPLE: SampleObject[];
	BPM: BPMObject[];
	METER: MeterObject[];
	BGM: BGMObject[];
	TIMINGWINDOW: TimingWindowsObject[];
	MEASUREBAR: MeasureBarObject[];
	EOC: EOCObject[];
	SCRATCH: ScratchObject[];
	NOTE: NoteObject[];
	BSS: BSSObject[];
	HBSS: BSSObject[];
	CN: CNObject[];
	HCN: CNObject[];
}

export interface IIDXParserContext {
	filename?: string;
	songTitle?: string;
	songArtist?: string;
	charter?: string;
	genre?: string;
	level?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | null;
	marquee?: string;
}

export interface IIDXParserOptions {
	errOnCN?: boolean;
	errOnHCN?: boolean;
	isHellCharge?: boolean;
	tickrate?: number;
}

export interface ParsedIIDXChart {
	playtype: "DP" | "SP";
	title: string | null;
	artist: string | null;
	genre: string | null;
	notecount: integer;
	level: string | null;
	marquee: string | null;
	difficulty: "ANOTHER" | "BEGINNER" | "HYPER" | "LEGGENDARIA" | "NORMAL";
	events: IIDXChartEvents;
}

// no such thing as a DP-BEGINNER.
type Difficulties = Exclude<
	`${"DP" | "SP"}-${"ANOTHER" | "BEGINNER" | "HYPER" | "LEGGENDARIA" | "NORMAL"}`,
	"DP-BEGINNER"
>;

export interface IIDXConvertOutput {
	title: string;
	artist: string;
	marquee: string;
	folder: number;
	genre: string;
	levels: Record<Difficulties, number>;
	notecounts: Record<Difficulties, number>;
	songID: integer;
}
