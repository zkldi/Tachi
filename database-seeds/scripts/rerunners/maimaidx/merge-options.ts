import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import {
	CreateChartID,
	GetFreshSongIDGenerator,
	MutateCollection,
	ReadCollection,
	WriteCollection,
} from "../../util";
import { ChartDocument, Difficulties, GetGamePTConfig, SongDocument } from "tachi-common";
import { CreateLogger } from "mei-logger";

const logger = CreateLogger("merge-options");

const VERSION_DISPLAY_NAMES = [
	"maimai",
	"maimai PLUS",
	"GreeN",
	"GreeN PLUS",
	"ORANGE",
	"ORANGE PLUS",
	"PiNK",
	"PiNK PLUS",
	"MURASAKi",
	"MURASAKi PLUS",
	"MiLK",
	"MiLK PLUS",
	"FiNALE",
	"maimaiでらっくす",
	"maimaiでらっくす PLUS",
	"Splash",
	"Splash PLUS",
	"UNiVERSE",
	"UNiVERSE PLUS",
	"FESTiVAL",
	"FESTiVAL PLUS",
	"BUDDiES",
	"BUDDiES PLUS",
];
const DIFFICULTIES = [
	"Basic",
	"Advanced",
	"Expert",
	"Master",
	"Re:Master",
];

interface IDWithDisplayName {
	id: number;
	str: string;
}

interface NotesData {
	file: {
		path: string;
	};
	isEnable: boolean;
	level: number;
	levelDecimal: number;
	notesDesigner: IDWithDisplayName;
	notesType: number;
	musicLevelID: number;
	maxNotes: number;
}

interface MusicXML {
	MusicData: {
		disable: boolean;
		name: IDWithDisplayName;
		artistName: IDWithDisplayName;
		AddVersion: IDWithDisplayName;
		genreName: IDWithDisplayName;

		notesData: {
			Notes: NotesData[];
		};
	};
}

function calculateLevel(data: Pick<NotesData, "level" | "levelDecimal">) {
	return `${data.level}${data.levelDecimal >= 6 && data.level >= 7 ? "+" : ""}`;
}

function calculateLevelNum(data: Pick<NotesData, "level" | "levelDecimal">) {
	return Number(`${data.level}.${data.levelDecimal}`);
}

if (require.main !== module) {
	throw new Error(
		`This is a script. It should be ran directly from the command line with ts-node.`
	);
}

const program = new Command();
program
	.requiredOption("-i, --input <OPTIONS DIRS...>", "The options directories of your maimai DX install.")
	.requiredOption("-v, --version <VERSION>", "The version of this maimai DX install.")
	.option("-f, --force", "Forces inGameID overwrites where it shouldn't be automatically done.");
program.parse(process.argv);
const options = program.opts();

const versions = Object.keys(GetGamePTConfig("maimaidx", "Single").versions);

if (versions.indexOf(options.version) === -1) {
	throw new Error(
		`Invalid version of '${options.version}'. Expected any of ${
			versions.join(",")
		}. If you're adding a new version, go update common/src/config/game-config/maimai-dx.ts.`
	);
}

const isLatestVersion =
	versions.indexOf(options.version.replace(/(-intl|-omni)$/u, "")) === versions.length - 1;
const existingSongs: Array<SongDocument<"maimaidx">> = ReadCollection("songs-maimaidx.json");
const existingCharts: Array<ChartDocument<"maimaidx:Single">> =
	ReadCollection("charts-maimaidx.json");
const songMap = new Map(existingSongs.map((s) => [s.id, s]));
const chartMap = new Map<string, ChartDocument<"maimaidx:Single">>();
const songTitleArtistMap = new Map<string, number>();

for (const chart of existingCharts) {
	const song = songMap.get(chart.songID);

	if (song === undefined) {
		logger.error(
			`CONSISTENCY ERROR: Chart ID ${chart.chartID} does not belong to any songs! (songID was ${chart.songID})`
		);
		process.exit(1);
	}

	chartMap.set(`${song.title}-${song.artist}-${chart.difficulty}`, chart);
	songTitleArtistMap.set(`${song.title}-${song.artist}`, song.id);
}

const parser = new XMLParser();

const newSongs: Array<SongDocument<"maimaidx">> = [];
const newCharts: Array<ChartDocument<"maimaidx:Single">> = [];

const songIDGenerator = GetFreshSongIDGenerator("maimaidx");

for (const optionsDir of options.input) {
	for (const option of readdirSync(optionsDir)) {
		if (!option.match(/[A-Z]\d{3}/u)) {
			continue;
		}

		const optionDir = path.join(optionsDir, option);
		const musicsDir = path.join(optionsDir, option, "music");

		if (!existsSync(musicsDir)) {
			logger.warn(`Option at ${optionDir} does not have a "music" folder.`);
			continue;
		}

		logger.info(`Scanning music directory ${musicsDir} for songs.`);

		for (const music of readdirSync(musicsDir)) {
			if (!music.match(/music\d+$/u)) {
				continue;
			}

			const musicDir = path.join(musicsDir, music);

			if (!statSync(musicDir).isDirectory()) {
				continue;
			}

			const musicXmlLocation = path.join(musicDir, "Music.xml");

			if (!existsSync(musicXmlLocation)) {
				logger.warn(`Music folder at ${musicDir} does not have a Music.xml file.`);
				continue;
			}

			const data = parser.parse(readFileSync(musicXmlLocation)) as MusicXML;
			const musicData = data.MusicData;
			const inGameID = musicData.name.id;

			if (inGameID >= 100000) {
				// Ignore UTAGE charts, which are not supported by Tachi.
				continue;
			}

			// Manual override since the song's title is empty in the dataset and not
			// IDEOGRAPHIC SPACE (U+3000).
			let tachiSongID = inGameID === 11422
				? 959
				: songTitleArtistMap.get(`${musicData.name.str}-${musicData.artistName.str}`);
			
			// Has this song been disabled in-game?
			if (musicData.disable) {
				if (tachiSongID !== undefined) {
					logger.info(
						`Removing charts of song ID ${tachiSongID} from version ${
							options.version
						}, because the disable flag in Music.xml is enabled.`
					);

					// Songs are removed mid-version by marking the `disable` flag,
					// since option data can only add or overwrite, never remove.
					existingCharts
						.filter((c) => c.songID === tachiSongID)
						.forEach((c) => {
							const versionIndex = c.versions.indexOf(options.version);

							if (versionIndex !== -1) {
								c.versions.splice(versionIndex, 1);
							}
						});
				}
				
				continue;
			}
			
			// New song?
			if (tachiSongID === undefined) {
				const displayVersion = VERSION_DISPLAY_NAMES[musicData.AddVersion.id];

				if (!displayVersion) {
					throw new Error(
						`Unknown version ID ${
							musicData.AddVersion.id
						}. Update database-seeds/scripts/rerunners/maimaidx/merge-options.ts.`
					);
				}

				tachiSongID = songIDGenerator();

				const songDoc: SongDocument<"maimaidx"> = {
					title: musicData.name.str,
					altTitles: [],
					searchTerms: [],
					artist: musicData.artistName.str,
					id: tachiSongID,
					data: {
						displayVersion,
						genre: musicData.genreName.str,
					},
				};

				newSongs.push(songDoc);
				songTitleArtistMap.set(`${songDoc.title}-${songDoc.artist}`, tachiSongID);

				logger.info(`Added new song ${songDoc.artist} - ${songDoc.title}.`);
			}

			for (const [index, difficulty] of musicData.notesData.Notes.entries()) {
				if (!difficulty.isEnable || !existsSync(path.join(musicDir, difficulty.file.path))) {
					continue;
				}

				let difficultyName = DIFFICULTIES[index];

				if (difficultyName === undefined) {
					throw new Error(
						`Unknown difficulty ID ${
							index
						}. Update database-seeds/scripts/rerunners/maimaidx/merge-options.ts and possibly common/src/config/game-support/maimai-dx.ts.`
					);
				}
	
				if (inGameID > 10000) {
					difficultyName = `DX ${difficultyName}`;
				}
	
				let exists: ChartDocument<"maimaidx:Single"> | undefined;
	
				if (inGameID === 11422) {
					exists = chartMap.get(`-x0o0x_-${difficultyName}`);
				} else {
					exists = chartMap.get(
						`${musicData.name.str}-${musicData.artistName.str}-${difficultyName}`
					);
				}
	
				const level = calculateLevel(difficulty);
				const levelNum = calculateLevelNum(difficulty);
	
				if (exists) {
					const displayName = `${musicData.artistName.str} - ${musicData.name.str} [${exists.difficulty}] (${exists.chartID})`;

					if (exists.data.inGameID === null) {
						logger.info(`Adding inGameID ${inGameID} for chart ${displayName}.`);
						exists.data.inGameID = inGameID;
					} else if (exists.data.inGameID !== inGameID) {
						logger.warn(
							`The chart ${displayName} already exists in charts-maimaidx under a different inGameID (${
								exists.data.inGameID
							} != ${inGameID}). Is this a duplicate with a different inGameID?`
						);

						if (options.force) {
							logger.warn("Overwriting anyways, because --force has been requested.");
							exists.data.inGameID = inGameID;
						} else {
							logger.warn("Must be resolved manually. Use --force to overwrite anyways.");
						}
					}
					
					const versionIndex = exists.versions.indexOf(options.version);
	
					if (versionIndex === -1) {
						exists.versions.push(options.version);
					}
	
					if (isLatestVersion) {
						if (exists.level !== level) {
							logger.info(`Chart ${displayName} has had a level change: ${exists.level} -> ${level}.`);
							exists.level = level;
						}

						if (exists.levelNum !== levelNum) {
							logger.info(`Chart ${displayName} has had a levelNum change: ${exists.levelNum} -> ${levelNum}.`);
							exists.levelNum = levelNum;
						}
					}
	
					continue;
				}
	
				const chartDoc: ChartDocument<"maimaidx:Single"> = {
					chartID: CreateChartID(),
					songID: tachiSongID,
					difficulty: difficultyName as Difficulties["maimaidx:Single"],
					isPrimary: true,
					level,
					levelNum,
					versions: [options.version],
					playtype: "Single",
					data: {
						inGameID,
					},
				};
				
				newCharts.push(chartDoc);

				logger.info(`Inserted new chart ${musicData.artistName.str} - ${musicData.name.str} [${chartDoc.difficulty}] (${chartDoc.chartID}).`);
			}
		}
	}
} 

MutateCollection("songs-maimaidx.json", (songs: Array<SongDocument<"maimaidx">>) => [
	...songs,
	...newSongs,
]);

// overwrite this collection instead of mutating it
// we already know the existing chart docs and might have mutated them to
// declare the new versions, or update chart constants.
WriteCollection("charts-maimaidx.json", [...existingCharts, ...newCharts]);
