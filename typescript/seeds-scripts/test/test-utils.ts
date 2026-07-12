import { ALL_GAMES, allSupportedGameGroups, type GameGroup } from "tachi-common";

import { ReadCollection } from "../util";
import { type V3_SCHEMAS } from "./schemas";

const songMap = {};

// TODO(zk): Hack for "joins" in json-land.
// and pretty formatting of that data.
for (const gameGroup of allSupportedGameGroups) {
	const songs = ReadCollection(`songs-${gameGroup}.json`);

	songMap[gameGroup] = Object.fromEntries(songs.map((e) => [e.id, e]));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const songFormat = (s: any) => `${s.artist} - ${s.title} (${s.id})`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartFormat = (s: any, gameGroup: GameGroup) =>
	`${songMap[gameGroup][s.songID] ? songFormat(songMap[gameGroup][s.songID]) : s.songID} - ${
		s.playtype
	} ${s.difficulty} (${s.chartID})`;

export const FormatFunctions: Partial<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Record<keyof typeof V3_SCHEMAS, (d: any, gameGroup: GameGroup | null) => string>
> = {
	"bms-course-lookup.json": (d) => d.title,
	"folders.json": (d) => d.title,
	"tables.json": (d) => d.title,
	"quests.json": (d) => `${d.name} (${d.questID})`,
	"questlines.json": (d) => `${d.name} (${d.questlineID})`,
	"goals.json": (d) => `${d.name} (${d.goalID})`,
};

for (const gameGroup of allSupportedGameGroups) {
	FormatFunctions[`songs-${gameGroup}.json`] = songFormat;
}

for (const game of ALL_GAMES) {
	// TODO(zk): again just a part of this shitty hack
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	FormatFunctions[`charts-${game}.json`] = chartFormat as any;
}
