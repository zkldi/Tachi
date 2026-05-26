import { log } from "#log";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import {
	type ChartDocument,
	type Difficulties,
	type GamesForGroup,
	type integer,
	LEGACY_GetGamePTConfig,
	type SongDocument,
	type Versions,
} from "tachi-common";

import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../../util";
import { ParseIIDXData } from "./convert";

if (require.main !== module) {
	throw new Error(`This is a script. It should be ran directly from the command line with bun.`);
}

const program = new Command();
program
	.requiredOption("-b, --basedir <dir>", "The base of this IIDX install.")
	.requiredOption("-i, --index <val>", "Whether this game uses 0 or 1 for the mdb.")
	.requiredOption("-v, --version <This .bin version name>")
	.option("-o, --omni", "Whether to fetch omnimix or not.")
	.option("-f --force", "Forces overwrites when they shouldn't be automatically done.")
	.option(
		"--always-extract",
		"Always re-extract IFS files even when they exist in ifs-output. Useful if the IFS files have changed.",
	);

program.parse(process.argv);
const options = program.opts() as {
	alwaysExtract: boolean;
	basedir: string;
	force: boolean;
	index: "0" | "1";
	omni: boolean;
	version: Versions["iidx-sp"];
};

const iidxConfig = LEGACY_GetGamePTConfig("iidx", "SP");

if (!Object.keys(iidxConfig.versions).includes(options.version)) {
	throw new Error(
		`Invalid version of '${options.version}'. Expected any of ${Object.keys(
			iidxConfig.versions,
		).join(
			", ",
		)}. If you're adding a new version, go update common/src/config/game-config/iidx.ts.`,
	);
}

if (options.index !== "0" && options.index !== "1") {
	throw new Error(`Expected an --index of 0 or 1. Got ${options.index}.`);
}

const existingCharts: ChartDocument<GamesForGroup["iidx"]>[] = ReadCollection("charts-iidx.json");

const existingSongs: SongDocument<"iidx">[] = ReadCollection("songs-iidx.json");

const blacklist = fs
	.readFileSync(path.join(__dirname, "blacklist.txt"), "utf-8")
	.split("\n")
	.filter((e) => !e.startsWith("#") && e.trim() !== "")
	.map((e) => new RegExp(e, "u"));

function isInBlacklist(str: string) {
	for (const regex of blacklist) {
		if (regex.exec(str)) {
			return true;
		}
	}

	return false;
}

async function ParseIIDXMDB() {
	// omni XOR -omni in version name
	// either both are true, or both are false
	// if they don't match, that's probably a mistake
	if (Boolean(options.omni) !== options.version.endsWith("-omni")) {
		throw new Error(
			`Using --omni flag, but the version you provided was ${options.version}, which doesn't look like an omnimix version.`,
		);
	}

	const mdbCharts = await ParseIIDXData(
		options.basedir,
		options.index,
		options.omni,
		options.alwaysExtract,
	);

	const chartMap = new Map<integer, ChartDocument<GamesForGroup["iidx"]>>();
	const songMap = new Map<integer, SongDocument<"iidx">>();
	const songTitleMap = new Map<string, SongDocument<"iidx">>();
	const chartDiffMap = new Map<string, ChartDocument<GamesForGroup["iidx"]>>();

	for (const song of existingSongs) {
		songMap.set(song.id, song);
		songTitleMap.set(song.title, song);
	}

	for (const chart of existingCharts) {
		// what, you thought this was easy?
		if (Array.isArray(chart.data.inGameID)) {
			for (const igid of chart.data.inGameID) {
				chartMap.set(igid, chart);
			}
		} else {
			chartMap.set(chart.data.inGameID, chart);
		}
	}

	for (const chart of existingCharts) {
		if (Array.isArray(chart.data.inGameID)) {
			for (const igid of chart.data.inGameID) {
				chartDiffMap.set(`${igid}-${chart.playtype}-${chart.difficulty}`, chart);
			}
		} else {
			chartDiffMap.set(`${chart.data.inGameID}-${chart.playtype}-${chart.difficulty}`, chart);
		}
	}

	const getFreeSongID = GetFreshSongIDGenerator("iidx");

	for (const inp of mdbCharts) {
		if (isInBlacklist(`S${inp.songID}`)) {
			log.debug(
				`Skipped ${inp.artist} - ${inp.title} (${inp.songID}) as it was in the blacklist.`,
			);
			continue;
		}

		const anySongIDMatch = chartMap.get(inp.songID);
		let song: SongDocument<"iidx">;

		if (!anySongIDMatch) {
			// new song?

			const titleAlreadyExists = songTitleMap.get(inp.title);

			if (titleAlreadyExists) {
				log.warn(
					`A song called '${inp.title}' already exists in songs-iidx (songID:${titleAlreadyExists.id}). Is this a duplicate with a different inGameID?`,
				);

				if (!options.force) {
					log.warn(
						`Must be resolved manually. Use --force to blindly overwrite it anyway.`,
					);
					continue;
				} else {
					log.warn(`--force provided, adding it to the DB anyway.`);
				}
			}

			const searchTerms: string[] = [];
			if (inp.marquee.toLowerCase() !== inp.title.toLowerCase()) {
				searchTerms.push(inp.marquee);
			}

			const tachiSong: SongDocument<"iidx"> = {
				id: getFreeSongID(),
				artist: inp.artist,
				title: inp.title,
				data: {
					genre: inp.genre,
					displayVersion: inp.folder.toString(),
				},
				searchTerms: searchTerms,
				altTitles: [],
			};

			log.info(`Added new song ${inp.title}.`);

			if (inp.title.match(/\?/gu)) {
				log.warn(
					`${inp.title} has a potentially konami-screwed title. Investigate it manually.`,
				);
			}

			if (inp.artist.match(/\?/gu)) {
				log.warn(
					`${inp.artist} - ${inp.title} has a potentially konami-screwed title. Investigate it manually.`,
				);
			}

			existingSongs.push(tachiSong);

			song = tachiSong;
		} else {
			const sxng = songMap.get(anySongIDMatch.songID);

			if (!sxng) {
				log.error(`Song ${anySongIDMatch.songID} has charts but no song?`);
				throw new Error(`Song ${anySongIDMatch.songID} has charts but no song?`);
			}
			song = sxng;
		}

		const diffNames = Object.keys(inp.levels) as (keyof typeof inp.levels)[];

		for (const diffName of diffNames) {
			if (isInBlacklist(`C${inp.songID}-${diffName}`)) {
				log.debug(
					`Ignored ${song.title} (${inp.songID}) ${diffName} as it was in the blacklist.`,
				);
				continue;
			}

			const chart = chartDiffMap.get(`${inp.songID}-${diffName}`);

			const notecount = inp.notecounts[diffName];
			const level = inp.levels[diffName];

			if (level === 0 && notecount && notecount > 0) {
				log.info(
					`Chart ${song.title} ${diffName} has notecount ${notecount}, but has no level assigned. Skipping.`,
				);
				continue;
			}
			if (level === 0) {
				continue;
			}

			if (!chart) {
				// no chart && no notecount => chart has never existed
				// and still doesnt.
				if (!notecount) {
					continue;
				}

				// otherwise, make new chart?
				const playtypeStr = diffName.split("-")[0] as "DP" | "SP";
				const game: GamesForGroup["iidx"] = playtypeStr === "SP" ? "iidx-sp" : "iidx-dp";
				const tachiChart: ChartDocument<GamesForGroup["iidx"]> = {
					game,
					chartID: CreateChartID(),
					difficulty: diffName.split("-")[1] as Difficulties[GamesForGroup["iidx"]],
					level: level.toString(),
					levelNum: level,
					isPrimary: true,
					playtype: playtypeStr,

					songID: song.id,
					versions: [options.version],
					data: {
						inGameID: inp.songID,
						notecount,
						hashSHA256: null,
						"2dxtraSet": null,
						bpiCoefficient: null,
						kaidenAverage: null,
						worldRecord: null,
					},
				};

				log.info(`Inserting new chart ${inp.title} ${diffName}.`);
				existingCharts.push(tachiChart);
			} else {
				if (!notecount) {
					log.warn(
						`Chart ${inp.title} ${diffName} already exists, but has no notecount anymore. Not marking it as part of this version.`,
					);
					continue;
				}

				// chart already exists, diff notecounts.
				if (chart.data.notecount !== notecount) {
					log.warn(
						`Chart ${inp.title} ${diffName} has a different notecount in the JSON to the data just parsed. Has this chart been edited? OLD: ${chart.data.notecount} -> NEW: ${notecount}.`,
					);
					if (!options.force) {
						log.warn(
							`Must be resolved manually. Use --force to blindly overwrite it anyway.`,
						);
						continue;
					}
					chart.data.notecount = notecount;
				}

				if (chart.levelNum !== level) {
					log.info(
						`Chart ${inp.title} ${diffName} has had a level change. ${chart.level} -> ${level}. Updating this.`,
					);
					chart.level = level.toString();
					chart.levelNum = level;
				}

				if (!chart.versions.includes(options.version)) {
					chart.versions.push(options.version);
				}
			}
		}
	}

	WriteCollection("songs-iidx.json", existingSongs);
	WriteCollection("charts-iidx.json", existingCharts);
}

ParseIIDXMDB();
