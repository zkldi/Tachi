import { ReadCollection, WriteCollection } from "../../util";
import { type ChartDocument } from "tachi-common";

const SONG_BLACKLIST = [
	"particlearts",
	"ignotusafterburn",
	"redandblueandgreen",
	"singularityvvvip",
	"overdead",
	"mismal",
	"ifirmx",
	"hivemindrmx",
	"lfdyrmx",
	"unknownrmx",
];

const logNotecountChanges: [string, number, number][] = [];
const logLevelChanges: [string, number, number][] = [];
const logToolbeltErrors: Set<string> = new Set();
const logArcsongErrors: Set<string> = new Set();
const logErrors: string[] = [];

const inverseConvertDifficulty = (input: string) => {
	switch (input) {
		case "Past":
			return 0;
		case "Present":
			return 1;
		case "Future":
			return 2;
		case "Beyond":
			return 3;
		case "Eternal":
			return 4;
		default:
			throw new Error(
				`Unknown difficulty ${input}, can't convert this into one of Arcaea's difficulty values. Consider updating the script.`,
			);
	}
};

type DataRow = {
	levelNum: number;
	notecount: number;
};

const getToolbeltData = (toolbeltData: any, chart: ChartDocument<"arcaea">): DataRow | null => {
	const toolbeltSong = toolbeltData.find((s) => s.id === chart.data.inGameStrID);

	if (toolbeltSong === undefined) {
		logToolbeltErrors.add(`Unknown song: ${chart.data.inGameStrID}`);
		return null;
	}

	const toolbeltChart = toolbeltSong.charts[inverseConvertDifficulty(chart.difficulty)];

	if (toolbeltChart === undefined) {
		logToolbeltErrors.add(`Unknown chart: ${chart.data.inGameStrID} ${chart.difficulty}`);
		return null;
	}

	return { notecount: toolbeltChart.notes, levelNum: toolbeltChart.constant };
};

const getArcsongData = (arcsongData: any, chart: ChartDocument<"arcaea">): DataRow | null => {
	const arcsongChart = arcsongData.find(
		(c) =>
			c.song_id === chart.data.inGameStrID &&
			c.rating_class === inverseConvertDifficulty(chart.difficulty),
	);

	if (arcsongChart === undefined) {
		logArcsongErrors.add(
			`[Arcsong] Unknown chart: ${chart.data.inGameStrID} ${chart.difficulty}`,
		);
		return null;
	}

	return { notecount: arcsongChart.note, levelNum: arcsongChart.rating / 10 };
};

const syncNotesAndConstants = async () => {
	const rawToolbeltData = await fetch(
		"https://raw.githubusercontent.com/DarrenDanielDay/arcaea-toolbelt-data/refs/heads/main/src/data/notes-and-constants.json",
	);
	const toolbeltData = await rawToolbeltData.json();
	const rawArcsongData = await fetch(
		"https://raw.githubusercontent.com/CuSO4Deposit/ArcaeaSongDatabase/refs/heads/main/arcsong.json",
	);
	const arcsongData = await rawArcsongData.json();

	const charts = ReadCollection("charts-arcaea.json");

	for (const chart of charts) {
		if (SONG_BLACKLIST.includes(chart.data.inGameStrID)) {
			continue;
		}

		const toolbelt = getToolbeltData(toolbeltData, chart);
		const arcsong = getArcsongData(arcsongData, chart);
		const chartName = `${chart.data.inGameStrID} ${chart.difficulty}`;

		if (toolbelt === null && arcsong === null) {
			logErrors.push(`No data for ${chartName}`);
			continue;
		}

		if (toolbelt && arcsong && toolbelt.notecount !== arcsong.notecount) {
			logErrors.push(
				`notecount mismatch on ${chartName}: T=${toolbelt.notecount} A=${arcsong.notecount}`,
			);
		} else {
			const notecount = toolbelt?.notecount ?? arcsong!.notecount;
			if (chart.data.notecount !== notecount) {
				logNotecountChanges.push([chartName, chart.data.notecount, notecount]);
				chart.data.notecount = notecount;
			}
		}

		if (toolbelt && arcsong && toolbelt.levelNum !== arcsong.levelNum) {
			logErrors.push(
				`levelNum mismatch on ${chartName}: T=${toolbelt.levelNum} A=${arcsong.levelNum}`,
			);
		} else {
			const levelNum = toolbelt?.levelNum ?? arcsong!.levelNum;
			if (chart.levelNum !== levelNum) {
				logLevelChanges.push([chartName, chart.levelNum, levelNum]);
				chart.levelNum = levelNum;
			}
		}
	}

	console.log("Notecount changes:");
	for (const [name, old, updated] of logNotecountChanges) {
		if (old === undefined) {
			console.log(`\t${name}: ${updated}`);
		} else {
			console.error(`\t${name}: ${old} -> ${updated} THIS SHOULD NOT HAVE HAPPENED`);
		}
	}
	console.log("\nLevel changes:");
	for (const [name, old, updated] of logLevelChanges) {
		console.log(`\t${name}: ${old} -> ${updated}`);
	}
	console.log("\nData problems:");
	for (const row of logToolbeltErrors) {
		console.warn(`\t[Toolbelt] ${row}`);
	}
	for (const row of logArcsongErrors) {
		console.warn(`\t[Arcsong] ${row}`);
	}
	console.log("\nErrors:");
	for (const row of logErrors) {
		console.error("\t" + row.split("\n").join("\n\t"));
	}

	WriteCollection("charts-arcaea.json", charts);
};

syncNotesAndConstants();
