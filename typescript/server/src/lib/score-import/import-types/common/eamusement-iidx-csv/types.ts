import type { Versions } from "tachi-common";

export interface EamusementScoreData {
	difficulty: "ANOTHER" | "BEGINNER" | "HYPER" | "LEGGENDARIA" | "NORMAL";
	lamp: string;
	exscore: string;
	pgreat: string;
	great: string;
	bp: string;
	level: string;
}

interface BaseProps {
	title: string;
	timestamp: string;
}

export type IIDXEamusementCSVData = {
	score: EamusementScoreData;
} & BaseProps;

type Props = "bp" | "exscore" | "great" | "lamp" | "level" | "pgreat";

type RawPropKeys = `${"another" | "beginner" | "hyper" | "leggendaria" | "normal"}-${Props}`;

export type RawIIDXEamusementCSVData = {
	[K in RawPropKeys]: unknown;
} & BaseProps &
	Record<string, unknown>;

export interface IIDXEamusementCSVContext {
	playtype: "DP" | "SP";
	importVersion: Versions["iidx-dp" | "iidx-sp"];
	hasBeginnerAndLegg: boolean;
	service: string;
}
