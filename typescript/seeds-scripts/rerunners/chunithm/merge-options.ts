import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import {
	type SEEDS_ChartDocument,
	type Difficulties,
	type integer,
	GetGameConfig,
	type SEEDS_SongDocument,
} from "tachi-common";

import { log } from "../../log";
import { CreateChartID, CreateSongID, ReadCollection, WriteCollection } from "../../util";

const OMNIMIX_OPTION_NAMES = ["AOMN", "AOLD", "AKON", "A300"];
const DISPLAY_VERSIONS = [
	"CHUNITHM",
	"CHUNITHM PLUS",
	"CHUNITHM AIR",
	"CHUNITHM AIR PLUS",
	"CHUNITHM STAR",
	"CHUNITHM STAR PLUS",
	"CHUNITHM AMAZON",
	"CHUNITHM AMAZON PLUS",
	"CHUNITHM CRYSTAL",
	"CHUNITHM CRYSTAL PLUS",
	"CHUNITHM PARADISE",
	"CHUNITHM PARADISE LOST",
	"CHUNITHM NEW",
	"CHUNITHM NEW PLUS",
	"CHUNITHM SUN",
	"CHUNITHM SUN PLUS",
	"CHUNITHM LUMINOUS",
	"CHUNITHM LUMINOUS PLUS",
	"CHUNITHM VERSE",
	"CHUNITHM X-VERSE",
	"CHUNITHM X-VERSE-X",
];
const VERSIONS = [
	"paradiselost",
	"sun",
	"sunplus",
	"luminous",
	"luminousplus",
	"verse",
	"xverse",
	"xversex",
];

// WE charts that need extra disambiguators. Mapping of inGameID to the disambiguator.
const DIFFICULTY_EXTRAS = new Map<integer, string>([
	// Genesis type-?
	[8190, "A"],
	[8191, "B"],
	[8192, "C"],
	// Random
	[8244, "LASTMORN"],
	[8245, "Implexrough"],
	[8246, "Shannon's Theorem"],
	[8247, "Just Say It"],
	[8248, "2anyFirst"],
	[8249, "Alt Futur"],
]);

interface IDWithDisplayName {
	id: string;
	str: string;
	data: string;
}

interface MusicFumenData {
	type: IDWithDisplayName;
	enable: boolean;
	level: string;
	levelDecimal: string;
	notesDesigner: string;
	defaultBpm: string;
}

interface MusicXML {
	MusicData: {
		releaseTagName: IDWithDisplayName;
		disableFlag: boolean;
		name: IDWithDisplayName;
		artistName: IDWithDisplayName;
		// I know it's supposed to be a list, but CHUNITHM has never had multi-genre songs
		// and also the XML parser returns it as an object.
		genreNames: {
			list: {
				StringID: IDWithDisplayName;
			};
		};
		cueFileName: IDWithDisplayName;
		worldsEndTagName: IDWithDisplayName;
		starDifType: string;
		fumens: {
			MusicFumenData: MusicFumenData[];
		};
	};
}

function calculateLevel(level: integer, levelDecimal: integer) {
	return `${level}${levelDecimal >= 50 ? "+" : ""}`;
}

function calculateLevelNum(data: Pick<MusicFumenData, "level" | "levelDecimal">) {
	return Number(`${data.level}.${data.levelDecimal}`);
}

function randomHex(byteLength: number): string {
	const buf = new Uint8Array(byteLength);

	globalThis.crypto.getRandomValues(buf);

	let hex = "";
	for (let i = 0; i < buf.length; i++) {
		hex += buf[i]!.toString(16).padStart(2, "0");
	}

	return hex;
}

if (require.main !== module) {
	throw new Error(`This is a script. It should be ran directly from the command line with bun.`);
}

const program = new Command()
	.requiredOption(
		"-i, --input <OPTIONS DIRS...>",
		"The options directories of your CHUNITHM install. Typically App/data and Option.",
	)
	.requiredOption("-v, --version <VERSION>", "The version of this CHUNITHM install.")
	.option("-f, --force", "Forces overwrites where it shouldn't be done automatically.")
	.parse(process.argv);
const options = program.opts();

const baseVersion = options.version.replace(/(-intl|-omni)$/u, "");
const tachiVersions = Object.keys(GetGameConfig("chunithm").versions);

if (!VERSIONS.includes(baseVersion)) {
	throw new Error(
		`Invalid base version ${baseVersion}. Expected any of ${VERSIONS.join(
			",",
		)}. Update the VERSIONS array in seeds/scripts/rerunners/chunithm/merge-options.ts.`,
	);
}

if (!tachiVersions.includes(options.version)) {
	throw new Error(
		`Invalid version ${options.version}. Expected any of ${tachiVersions.join(
			",",
		)}. If you're adding a new version, go update common/src/config/game-config/chunithm.ts.`,
	);
}

const isOmnimixVersion = /-omni$/u.test(options.version);
const isLatestVersion = VERSIONS.indexOf(baseVersion) === VERSIONS.length - 1;

const existingSongDocs: Array<SEEDS_SongDocument<"chunithm">> =
	ReadCollection("songs-chunithm.json");
const existingChartDocs: Array<SEEDS_ChartDocument<"chunithm">> =
	ReadCollection("charts-chunithm.json");

const songMap = new Map(existingSongDocs.map((s) => [s.id, s]));
const songTitleArtistMap = new Map(existingSongDocs.map((s) => [`${s.title} - ${s.artist}`, s]));
const inGameIDToSongIDMap = new Map<number, string>();
const existingCharts = new Map<string, SEEDS_ChartDocument<"chunithm">>();

for (const chart of existingChartDocs) {
	if (Array.isArray(chart.data.inGameID)) {
		for (const igid of chart.data.inGameID) {
			inGameIDToSongIDMap.set(igid, chart.songID);
			existingCharts.set(`${igid}-${chart.difficulty}`, chart);
		}
	} else {
		inGameIDToSongIDMap.set(chart.data.inGameID, chart.songID);
		existingCharts.set(`${chart.data.inGameID}-${chart.difficulty}`, chart);
	}
}

const parser = new XMLParser({
	numberParseOptions: {
		hex: false,
		leadingZeros: false,
		// do not coerce any number-like strings to numbers, since song titles
		// may also be numbers. we coerce anything we know to be a number later.
		skipLike: /.*/u,
	},
});

const newSongs: Array<SEEDS_SongDocument<"chunithm">> = [];
const newCharts: Array<SEEDS_ChartDocument<"chunithm">> = [];

for (const optionsDir of options.input) {
	for (const option of readdirSync(optionsDir)) {
		if (!isOmnimixVersion && OMNIMIX_OPTION_NAMES.includes(option)) {
			log.warn(
				`Ignoring omnimix option ${option} because the version specified is not an omnimix version.`,
			);
			continue;
		}

		if (!/[A-Z]\d{3}/u.test(option) && !OMNIMIX_OPTION_NAMES.includes(option)) {
			continue;
		}

		const optionDir = path.join(optionsDir, option);
		const musicsDir = path.join(optionDir, "music");

		if (!statSync(optionDir).isDirectory()) {
			continue;
		}

		if (!existsSync(musicsDir) || !statSync(musicsDir).isDirectory()) {
			log.warn(`Option at ${optionDir} does not have a "music" directory.`);
			continue;
		}

		log.info(`Scanning music directory ${musicsDir} for songs.`);

		for (const music of readdirSync(musicsDir)) {
			const musicDir = path.join(musicsDir, music);

			if (!/music\d+$/u.test(music)) {
				continue;
			}

			if (!statSync(musicDir).isDirectory()) {
				log.warn(`Ignoring ${musicDir} because it is not a directory.`);
				continue;
			}

			const musicXmlLocation = path.join(musicDir, "Music.xml");

			if (!existsSync(musicXmlLocation) || !statSync(musicXmlLocation).isFile()) {
				log.warn(`Music directory at ${musicDir} does not have a Music.xml file.`);
				continue;
			}
			const data = parser.parse(readFileSync(musicXmlLocation)) as MusicXML;
			const musicData = data.MusicData;
			const inGameID = Number(musicData.name.id);

			if (inGameID === 50 || inGameID === 81) {
				// Ignoring WORLD'S END charts, the basic tutorial chart,
				// and the master tutorial chart.
				continue;
			}

			const displayVersion = DISPLAY_VERSIONS[Number(musicData.releaseTagName.id)];

			if (!displayVersion) {
				throw new Error(
					`Unknown version ID ${musicData.releaseTagName.id}. Update seeds/scripts/rerunners/chunithm/merge-options.ts.`,
				);
			}

			let tachiSongID: string | undefined;
			let isChildWE: boolean = true;

			// Attempt to relate the WORLD'S END chart to the parent song. This can be done using the cueFileID,
			// since generally the WORLD'S END chart and the regular chart share the same audio. This is however
			// *not* the case for Random, since like the BMS gimmick, it has 6 different WE charts, each with
			// their own audio.
			if (inGameID >= 8000) {
				// happy path: uses same cue file as the regular song
				tachiSongID = inGameIDToSongIDMap.get(Number(musicData.cueFileName.id));
				isChildWE = tachiSongID !== undefined;

				// fallback 1: lookup by title - artist
				if (tachiSongID === undefined) {
					const tachiSong = songTitleArtistMap.get(
						`${musicData.name.str} - ${musicData.artistName.str}`,
					);

					tachiSongID = tachiSong?.id;
					isChildWE = tachiSongID !== undefined;
				}

				// fallback 2: worlds end exclusive song
				if (tachiSongID === undefined) {
					tachiSongID = inGameIDToSongIDMap.get(inGameID);
					isChildWE = false;
				}

				// at this point if tachiSongID is still undefined then it's very likely a new WE
			} else {
				tachiSongID = inGameIDToSongIDMap.get(inGameID);
				isChildWE = false;
			}

			// Has this song been disabled in-game?
			if (musicData.disableFlag) {
				if (tachiSongID !== undefined) {
					log.info(
						`Removing charts of song ${musicData.artistName.str} - ${musicData.name.str} (ID ${tachiSongID}) from version ${options.version}, because disableFlag is enabled.`,
					);

					existingChartDocs
						.filter((c) => c.songID === tachiSongID)
						.forEach((c) => {
							const index = c.versions.indexOf(options.version);

							if (index !== -1) {
								c.versions.splice(index, 1);
							}
						});
				}

				continue;
			}

			// New song?
			if (tachiSongID === undefined) {
				const existingTitle = songTitleArtistMap.get(
					`${musicData.name.str} - ${musicData.artistName.str}`,
				);

				if (existingTitle) {
					log.warn(
						`A song called ${musicData.artistName.str} - ${musicData.name.str} already exists in songs-chunithm (ID ${existingTitle.id}). Is this a duplicate with a given inGameID?`,
					);

					if (options.force) {
						log.warn("--force was requested, adding this song anyways.");
					} else {
						log.warn("Must be resolved manually. Use --force to overwrite anyways.");
						continue;
					}
				}

				tachiSongID = CreateSongID();

				const songDoc: SEEDS_SongDocument<"chunithm"> = {
					title: musicData.name.str,
					altTitles: [],
					searchTerms: [],
					artist: musicData.artistName.str,
					id: tachiSongID,
					legacySongID: inGameID,
					data: {
						genre: musicData.genreNames.list.StringID.str,
					},
				};

				newSongs.push(songDoc);
				inGameIDToSongIDMap.set(inGameID, tachiSongID);
				songMap.set(tachiSongID, songDoc);

				log.info(`Added new song ${songDoc.artist} - ${songDoc.title}.`);
			} else if (!isChildWE && songMap.has(tachiSongID)) {
				const songDoc = songMap.get(tachiSongID)!;

				songDoc.title = musicData.name.str;
				songDoc.artist = musicData.artistName.str;
				songDoc.data.genre = musicData.genreNames.list.StringID.str;
			} else if (!isChildWE) {
				throw new Error(
					`CONSISTENCY ERROR: Song ID ${tachiSongID} does not belong to any songs!`,
				);
			}

			for (const fumenData of musicData.fumens.MusicFumenData) {
				const difficultyName = fumenData.type.data;

				if (difficultyName === "WORLD'S END") {
					// starDifType can be 1, 3, 5, 7, 9 which corresponds to ☆1-5.
					let difficulty = `${musicData.worldsEndTagName.str}☆${Math.floor((Number(musicData.starDifType) + 1) / 2)}`;
					const disambiguator = DIFFICULTY_EXTRAS.get(inGameID);

					if (disambiguator !== undefined) {
						difficulty = `${difficulty} (${disambiguator})`;
					}

					const exists = existingCharts.get(`${inGameID}-${difficulty}`);

					if (exists) {
						const displayName = `${musicData.artistName.str} - ${musicData.name.str} [${difficulty}] (${exists.id})`;
						const versionIndex = exists.versions.indexOf(options.version);

						if (!fumenData.enable) {
							if (versionIndex !== -1) {
								log.info(
									`Removing ${displayName} from version ${options.version} because it has been disabled.`,
								);
								exists.versions.splice(versionIndex, 1);
							}

							continue;
						}

						if (versionIndex === -1) {
							log.info(`Adding ${displayName} to version ${options.version}.`);
							exists.versions.push(options.version);
						}

						if (isLatestVersion && exists.difficulty !== difficulty) {
							log.info(
								`Chart ${displayName} has had a difficulty change: ${exists.difficulty} -> ${difficulty}`,
							);
							exists.difficulty = difficulty;
						}

						if (isLatestVersion && exists.data.displayVersion !== displayVersion) {
							log.info(
								`Chart ${displayName} has had a displayVersion change: ${exists.data.displayVersion} -> ${displayVersion}`,
							);
							exists.data.displayVersion = displayVersion;
						}

						continue;
					}

					if (!fumenData.enable) {
						continue;
					}

					const chartDoc: SEEDS_ChartDocument<"chunithm"> = {
						id: CreateChartID(),
						legacyChartID: randomHex(20),
						songID: tachiSongID,
						difficulty,
						isPrimary: true,
						level: "",
						levelNum: 0,
						versions: [options.version],
						data: {
							inGameID,
							displayVersion,
						},
					};

					newCharts.push(chartDoc);

					// A later option may modify a new song in an earlier option, so we have to keep
					// track of that too. Awesome.
					existingCharts.set(`${inGameID}-${difficulty}`, chartDoc);

					log.info(
						`Added chart ${musicData.artistName.str} - ${musicData.name.str} [${difficulty}] (${chartDoc.id}).`,
					);
				} else {
					const level = calculateLevel(
						Number(fumenData.level),
						Number(fumenData.levelDecimal),
					);
					const levelNum = calculateLevelNum(fumenData);
					const exists = existingCharts.get(`${inGameID}-${difficultyName}`);

					if (exists) {
						const displayName = `${musicData.artistName.str} - ${musicData.name.str} [${difficultyName}] (${exists.id})`;
						const versionIndex = exists.versions.indexOf(options.version);

						if (!fumenData.enable) {
							if (versionIndex !== -1) {
								log.info(
									`Removing ${displayName} from version ${options.version} because it has been disabled.`,
								);
								exists.versions.splice(versionIndex, 1);
							}

							continue;
						}

						if (versionIndex === -1) {
							log.info(`Adding ${displayName} to version ${options.version}.`);
							exists.versions.push(options.version);
						}

						if (isLatestVersion && exists.level !== level) {
							log.info(
								`Chart ${displayName} has had a level change: ${exists.level} -> ${level}`,
							);
							exists.level = level;
						}

						if (isLatestVersion && exists.levelNum !== levelNum) {
							log.info(
								`Chart ${displayName} has had a levelNum change: ${exists.levelNum} -> ${levelNum}`,
							);
							exists.levelNum = levelNum;
						}

						if (
							isLatestVersion &&
							difficultyName !== "ULTIMA" &&
							exists.data.displayVersion !== displayVersion
						) {
							log.info(
								`Chart ${displayName} has had a displayVersion change: ${exists.data.displayVersion} -> ${displayVersion}`,
							);
							exists.data.displayVersion = displayVersion;
						}

						continue;
					}

					if (!fumenData.enable) {
						continue;
					}

					const chartDisplayVersion =
						difficultyName === "ULTIMA"
							? `CHUNITHM ${GetGameConfig("chunithm").versions[baseVersion]}`
							: displayVersion;
					const chartDoc: SEEDS_ChartDocument<"chunithm"> = {
						id: CreateChartID(),
						legacyChartID: randomHex(20),
						songID: tachiSongID,
						difficulty: difficultyName as Difficulties["chunithm"],
						isPrimary: true,
						level,
						levelNum,
						versions: [options.version],
						data: {
							inGameID,
							displayVersion: chartDisplayVersion,
						},
					};

					newCharts.push(chartDoc);

					// A later option may modify a new song in an earlier option, so we have to keep
					// track of that too. Awesome.
					existingCharts.set(`${inGameID}-${difficultyName}`, chartDoc);

					log.info(
						`Added chart ${musicData.artistName.str} - ${musicData.name.str} [${difficultyName}] (${chartDoc.id}).`,
					);
				}
			}
		}
	}
}

WriteCollection("songs-chunithm.json", [...existingSongDocs, ...newSongs]);

// overwrite this collection instead of mutating it
// we already know the existing chart docs and might have mutated them to
// declare the new versions, or update chart constants.
WriteCollection("charts-chunithm.json", [...existingChartDocs, ...newCharts]);
