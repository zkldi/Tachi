import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util";
import { ChartDocument, Difficulties, GetGamePTConfig, SongDocument } from "tachi-common";
import { CreateLogger } from "mei-logger";
import { execFileSync } from "child_process";

const logger = CreateLogger("merge-options");

const VERSION_DISPLAY_NAMES = [
	"maimai",
	"maimai PLUS",
	"maimai GreeN",
	"maimai GreeN PLUS",
	"maimai ORANGE",
	"maimai ORANGE PLUS",
	"maimai PiNK",
	"maimai PiNK PLUS",
	"maimai MURASAKi",
	"maimai MURASAKi PLUS",
	"maimai MiLK",
	"maimai MiLK PLUS",
	"maimai FiNALE",
	"maimaiでらっくす",
	"maimaiでらっくす PLUS",
	"maimaiでらっくす Splash",
	"maimaiでらっくす Splash PLUS",
	"maimaiでらっくす UNiVERSE",
	"maimaiでらっくす UNiVERSE PLUS",
	"maimaiでらっくす FESTiVAL",
	"maimaiでらっくす FESTiVAL PLUS",
	"maimaiでらっくす BUDDiES",
	"maimaiでらっくす BUDDiES PLUS",
	"maimaiでらっくす PRiSM",
	"maimaiでらっくす PRiSM PLUS",
];
const DIFFICULTIES = ["Basic", "Advanced", "Expert", "Master", "Re:Master"];
const GENRE_MAP = {
	101: "POPS＆アニメ",
	102: "niconico＆ボーカロイド",
	103: "東方Project",
	104: "ゲーム＆バラエティ",
	105: "maimai",
	106: "オンゲキ＆CHUNITHM",
};

interface StringID {
	id: string;
	str: string;
}

interface NotesData {
	file: {
		path: string;
	};
	isEnable: boolean;
	level: string;
	levelDecimal: string;
	notesDesigner: StringID;
	notesType: string;
	musicLevelID: string;
	maxNotes: string;
}

interface MusicXML {
	MusicData: {
		disable: boolean;
		name: StringID;
		artistName: StringID;
		AddVersion: StringID;
		genreName: StringID;
		eventName: StringID;
		cueName: StringID;

		notesData: {
			Notes: NotesData[];
		};
	};
}

function calculateLevel(data: Pick<NotesData, "level" | "levelDecimal">) {
	return `${data.level}${Number(data.levelDecimal) >= 6 && Number(data.level) >= 7 ? "+" : ""}`;
}

function calculateLevelNum(data: Pick<NotesData, "level" | "levelDecimal">) {
	return Number(`${data.level}.${data.levelDecimal}`);
}

if (require.main !== module) {
	throw new Error(
		`This is a script. It should be ran directly from the command line with ts-node.`
	);
}

const options = new Command()
	.requiredOption(
		"-i, --input <OPTIONS DIRS...>",
		"The options directories of your maimai DX install."
	)
	.requiredOption("-v, --version <VERSION>", "The version of this maimai DX install.")
	.option("-f, --force", "Forces inGameID overwrites where it shouldn't be automatically done.")
	.option(
		"--vgms-binary [PATH TO VGMSTREAM CLI]",
		"Path to vgmstream CLI. If specified, will parse song duration."
	)
	.parse(process.argv)
	.opts();

if (!options.vgmsBinary) {
	try {
		options.vgmsBinary = execFileSync("which", ["vgmstream-cli"]).toString("utf-8").trim();
	} catch (e) {
		// pass
	}
}

const versions = Object.keys(GetGamePTConfig("maimaidx", "Single").versions);

if (versions.indexOf(options.version) === -1) {
	throw new Error(
		`Invalid version of '${options.version}'. Expected any of ${versions.join(
			","
		)}. If you're adding a new version, go update common/src/config/game-config/maimai-dx.ts.`
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
const durationMap = new Map<string, number>();

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

const parser = new XMLParser({
	numberParseOptions: {
		hex: false,
		leadingZeros: false,
		// do not coerce any number-like strings to numbers, since song titles
		// may also be numbers. we coerce anything we know to be a number later.
		skipLike: /.*/u,
	},
});

const newSongs: Array<SongDocument<"maimaidx">> = [];
const newCharts: Array<ChartDocument<"maimaidx:Single">> = [];

const songIDGenerator = GetFreshSongIDGenerator("maimaidx");

for (const optionsDir of options.input) {
	for (const option of readdirSync(optionsDir)) {
		if (!option.match(/^[A-Z]\d{3}$/u)) {
			continue;
		}

		const optionDir = path.join(optionsDir, option);
		const musicsDir = path.join(optionDir, "music");
		const soundDataDir = path.join(optionDir, "SoundData");

		if (options.vgmsBinary && existsSync(soundDataDir)) {
			for (const cueFileName of readdirSync(soundDataDir)) {
				if (!cueFileName.match(/music\d+\.awb$/u)) {
					continue;
				}

				const cueName = cueFileName.replace(/\.awb$/u, "");
				const cuePath = path.join(soundDataDir, cueFileName);

				try {
					const stdout = execFileSync(options.vgmsBinary, ["-m", "-I", cuePath], {
						encoding: "utf-8",
					});
					const res = JSON.parse(stdout);

					if (res.sampleRate !== 48000) {
						logger.warn(
							`Sample rate of ${cuePath} is not 48000Hz (${res.sampleRate}Hz)`
						);
					}

					const duration = Number((res.numberOfSamples / res.sampleRate).toFixed(3));

					durationMap.set(cueName, duration);

					logger.info(`Cue file ${cueName} has duration ${duration} seconds.`);
				} catch (e) {
					logger.error(`Error parsing song duration: ${e}`);
				}
			}
		}

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
			const inGameID = Number(musicData.name.id);

			if (inGameID >= 100000 || inGameID === 11879) {
				// Ignore UTAGE charts, which are not supported by Tachi.
				// Ignore Xaleid◆scopiX (2): event chart used to implement the KALEIDXSCOPE event,
				// not normally playable.
				continue;
			}

			// Manual override since the song's title is empty in the dataset and not
			// IDEOGRAPHIC SPACE (U+3000).
			let tachiSongID =
				inGameID === 11422
					? 959
					: songTitleArtistMap.get(`${musicData.name.str}-${musicData.artistName.str}`);

			// Has this song been disabled in-game?
			if (musicData.disable || Number(musicData.eventName.id) === 0) {
				if (tachiSongID !== undefined) {
					logger.info(
						`Removing charts of song ID ${tachiSongID} from version ${options.version}, because the disable flag in Music.xml is enabled.`
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

			const displayVersion = VERSION_DISPLAY_NAMES[musicData.AddVersion.id];

			if (!displayVersion) {
				throw new Error(
					`Unknown version ID ${musicData.AddVersion.id}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts.`
				);
			}

			const genre = GENRE_MAP[musicData.genreName.id];

			if (!genre) {
				throw new Error(
					`Unknown genre ID ${musicData.genreName.id}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts`
				);
			}

			const duration = durationMap.get(`music${musicData.cueName.id.padStart(6, "0")}`);

			if (!duration) {
				logger.warn(
					`Unknown duration for music ID ${inGameID}, cue ID ${musicData.cueName.id}.`
				);
			}

			// New song?
			if (tachiSongID === undefined) {
				tachiSongID = songIDGenerator();

				const songDoc: SongDocument<"maimaidx"> = {
					title: musicData.name.str,
					altTitles: [],
					searchTerms: [],
					artist: musicData.artistName.str,
					id: tachiSongID,
					data: {
						genre,
						duration,
					},
				};

				newSongs.push(songDoc);
				songTitleArtistMap.set(`${songDoc.title}-${songDoc.artist}`, tachiSongID);
				songMap.set(tachiSongID, songDoc);

				logger.info(`Added new song ${songDoc.artist} - ${songDoc.title}.`);
			} else {
				const songDoc = songMap.get(tachiSongID)!;

				songDoc.title = musicData.name.str;
				songDoc.artist = musicData.artistName.str;
				songDoc.data = { genre, duration };
			}

			for (const [index, difficulty] of musicData.notesData.Notes.entries()) {
				if (
					!difficulty.isEnable ||
					!existsSync(path.join(musicDir, difficulty.file.path))
				) {
					continue;
				}

				let difficultyName = DIFFICULTIES[index];

				if (difficultyName === undefined) {
					throw new Error(
						`Unknown difficulty ID ${index}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts and possibly common/src/config/game-support/maimai-dx.ts.`
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
							`The chart ${displayName} already exists in charts-maimaidx under a different inGameID (${exists.data.inGameID} != ${inGameID}). Is this a duplicate with a different inGameID?`
						);

						if (options.force) {
							logger.warn("Overwriting anyways, because --force has been requested.");
							exists.data.inGameID = inGameID;
						} else {
							logger.warn(
								"Must be resolved manually. Use --force to overwrite anyways."
							);
						}
					}

					const versionIndex = exists.versions.indexOf(options.version);

					if (versionIndex === -1) {
						exists.versions.push(options.version);
					}

					if (isLatestVersion) {
						if (exists.level !== level) {
							logger.info(
								`Chart ${displayName} has had a level change: ${exists.level} -> ${level}.`
							);
							exists.level = level;
						}

						if (exists.levelNum !== levelNum) {
							logger.info(
								`Chart ${displayName} has had a levelNum change: ${exists.levelNum} -> ${levelNum}.`
							);
							exists.levelNum = levelNum;
						}
					}

					exists.data.displayVersion = displayVersion;

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
						displayVersion,
						inGameID,
					},
				};

				newCharts.push(chartDoc);

				logger.info(
					`Inserted new chart ${musicData.artistName.str} - ${musicData.name.str} [${chartDoc.difficulty}] (${chartDoc.chartID}).`
				);
			}
		}
	}
}

// overwrite this collection instead of mutating it
// we already know the existing chart docs and might have mutated them to
// declare the new versions, or update chart constants.
WriteCollection("songs-maimaidx.json", [...existingSongs, ...newSongs]);
WriteCollection("charts-maimaidx.json", [...existingCharts, ...newCharts]);
