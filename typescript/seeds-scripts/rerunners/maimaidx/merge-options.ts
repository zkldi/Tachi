import { log } from "../../log";
import { execFileSync } from "child_process";
import { Command } from "commander";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import {
	GetGameConfig,
	type SEEDS_ChartDocument,
	type Difficulties,
	type SEEDS_SongDocument,
	integer,
	CreateSongID,
} from "tachi-common";

import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util";

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
	"maimaiでらっくす CiRCLE",
];
const DIFFICULTIES = ["Basic", "Advanced", "Expert", "Master", "Re:Master"];
const GENRE_MAP: Record<integer, string> = {
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
		AddVersion: StringID;
		artistName: StringID;
		cueName: StringID;
		disable: boolean;
		eventName: StringID;
		genreName: StringID;
		name: StringID;

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
		`This is a script. It should be ran directly from the command line with ts-node.`,
	);
}

const options = new Command()
	.requiredOption(
		"-i, --input <OPTIONS DIRS...>",
		"The options directories of your maimai DX install.",
	)
	.requiredOption("-v, --version <VERSION>", "The version of this maimai DX install.")
	.option("-f, --force", "Forces inGameID overwrites where it shouldn't be automatically done.")
	.option(
		"--vgms-binary [PATH TO VGMSTREAM CLI]",
		"Path to vgmstream CLI. If specified, will parse song duration.",
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

const versions = Object.keys(GetGameConfig("maimaidx").versions);

if (versions.indexOf(options.version) === -1) {
	throw new Error(
		`Invalid version of '${options.version}'. Expected any of ${versions.join(
			",",
		)}. If you're adding a new version, go update common/src/config/game-config/maimai-dx.ts.`,
	);
}

const isLatestVersion =
	versions.indexOf(options.version.replace(/(-intl|-omni)$/u, "")) === versions.length - 1;
const existingSongs: Array<SEEDS_SongDocument<"maimaidx">> = ReadCollection("songs-maimaidx.json");
const existingCharts: Array<SEEDS_ChartDocument<"maimaidx">> =
	ReadCollection("charts-maimaidx.json");
const songMap = new Map(existingSongs.map((s) => [s.id, s]));
const chartMap = new Map<string, SEEDS_ChartDocument<"maimaidx">>();
const songTitleArtistMap = new Map<string, string>();
const durationMap = new Map<string, number>();

for (const chart of existingCharts) {
	const song = songMap.get(chart.songID);

	if (song === undefined) {
		log.error(
			`CONSISTENCY ERROR: Chart ID ${chart.id} does not belong to any songs! (songID was ${chart.songID})`,
		);
		process.exit(1);
	}

	chartMap.set(`${song.title}-${song.artist}-${chart.difficulty}`, chart);
	songTitleArtistMap.set(`${song.title}-${song.artist}`, song.id);
}

const blacklist = readFileSync(path.join(__dirname, "blacklist.txt"), "utf-8")
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

// Read all audio files ahead of time so the correct file is used, in case of
// audio fixes
if (options.vgmsBinary) {
	for (const optionsDir of options.input) {
		for (const option of readdirSync(optionsDir)) {
			if (!option.match(/^[A-Z]\d{3}$/u)) {
				continue;
			}

			const optionDir = path.join(optionsDir, option);
			const soundDataDir = path.join(optionDir, "SoundData");

			if (!existsSync(soundDataDir)) {
				continue;
			}

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
						log.warn(`Sample rate of ${cuePath} is not 48000Hz (${res.sampleRate}Hz)`);
					}

					const duration = Number((res.numberOfSamples / res.sampleRate).toFixed(3));

					durationMap.set(cueName, duration);

					log.info(`Cue file ${cueName} has duration ${duration} seconds.`);
				} catch (e) {
					log.error(`Error parsing song duration: ${e}`);
				}
			}
		}
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

const newSongs: Array<SEEDS_SongDocument<"maimaidx">> = [];
const newCharts: Array<SEEDS_ChartDocument<"maimaidx">> = [];

const songIDGenerator = GetFreshSongIDGenerator("maimaidx");

for (const optionsDir of options.input) {
	for (const option of readdirSync(optionsDir)) {
		if (!option.match(/^[A-Z]\d{3}$/u)) {
			continue;
		}

		const optionDir = path.join(optionsDir, option);
		const musicsDir = path.join(optionDir, "music");

		if (!existsSync(musicsDir)) {
			log.warn(`Option at ${optionDir} does not have a "music" folder.`);
			continue;
		}

		log.info(`Scanning music directory ${musicsDir} for songs.`);

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
				log.warn(`Music folder at ${musicDir} does not have a Music.xml file.`);
				continue;
			}

			const data = parser.parse(readFileSync(musicXmlLocation)) as MusicXML;
			const musicData = data.MusicData;
			const inGameID = Number(musicData.name.id);

			if (isInBlacklist(`S${inGameID}`)) {
				log.debug(
					`Ignored ${musicData.artistName.str} - ${musicData.name.str} (inGameID ${inGameID}) as it is in the blacklist.`,
				);
				continue;
			}

			
			let tachiSongID: string | undefined;
			if (inGameID === 11422) {
				// Manual override since the song's title is empty in the dataset and not
				// IDEOGRAPHIC SPACE (U+3000).
				tachiSongID = "S19d35e0d843641538f4";
			} else if (inGameID === 11956) {
				// Manual override because the song's title changed from Break the Speaker
				// to Break The Speakers, breaking title matching.
				tachiSongID = "S19e48709584f1679c4d";
			} else {
				tachiSongID = songTitleArtistMap.get(`${musicData.name.str}-${musicData.artistName.str}`);
			}

			// Has this song been disabled in-game?
			if (musicData.disable || Number(musicData.eventName.id) === 0) {
				if (tachiSongID !== undefined) {
					log.info(
						`Removing charts of song ID ${tachiSongID} from version ${options.version}, because the disable flag in Music.xml is enabled.`,
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

			const displayVersion = VERSION_DISPLAY_NAMES[Number(musicData.AddVersion.id)];

			if (!displayVersion) {
				throw new Error(
					`Unknown version ID ${musicData.AddVersion.id}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts.`,
				);
			}

			const genre = GENRE_MAP[Number(musicData.genreName.id)];

			if (!genre) {
				throw new Error(
					`Unknown genre ID ${musicData.genreName.id}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts`,
				);
			}

			const duration = durationMap.get(`music${musicData.cueName.id.padStart(6, "0")}`);

			if (!duration) {
				log.warn(
					`Unknown duration for music ID ${inGameID}, cue ID ${musicData.cueName.id}.`,
				);
			}

			// New song?
			if (tachiSongID === undefined) {
				tachiSongID = CreateSongID();
				const newLegacySongID = songIDGenerator();

				const songDoc: SEEDS_SongDocument<"maimaidx"> = {
					title: musicData.name.str,
					altTitles: [],
					searchTerms: [],
					artist: musicData.artistName.str,
					id: tachiSongID,
					legacySongID: newLegacySongID,
					data: {
						genre,
						duration,
					},
				};

				newSongs.push(songDoc);
				songTitleArtistMap.set(`${songDoc.title}-${songDoc.artist}`, tachiSongID);
				songMap.set(tachiSongID, songDoc);

				log.info(
					`Added new song ${songDoc.artist} - ${songDoc.title} (inGameID ${inGameID}, tachiSongID ${tachiSongID}).`,
				);
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
						`Unknown difficulty ID ${index}. Update seeds/scripts/rerunners/maimaidx/merge-options.ts and possibly common/src/config/game-support/maimai-dx.ts.`,
					);
				}

				if (isInBlacklist(`C${inGameID}-${difficultyName}`)) {
					log.debug(
						`Ignoring ${musicData.artistName.str} - ${musicData.name.str} [${difficultyName}] (inGameID ${inGameID}) as it is in the blacklist.`,
					);
					continue;
				}

				if (inGameID > 10000) {
					difficultyName = `DX ${difficultyName}`;
				}

				let exists: SEEDS_ChartDocument<"maimaidx"> | undefined;

				if (inGameID === 11422) {
					exists = chartMap.get(`-x0o0x_-${difficultyName}`);
				} else {
					exists = chartMap.get(
						`${musicData.name.str}-${musicData.artistName.str}-${difficultyName}`,
					);
				}

				const level = calculateLevel(difficulty);
				const levelNum = calculateLevelNum(difficulty);

				if (exists) {
					const displayName = `${musicData.artistName.str} - ${musicData.name.str} [${exists.difficulty}] (${exists.id})`;

					if (exists.data.inGameID === null) {
						log.info(`Adding inGameID ${inGameID} for chart ${displayName}.`);
						exists.data.inGameID = inGameID;
					} else if (exists.data.inGameID !== inGameID) {
						log.warn(
							`The chart ${displayName} already exists in charts-maimaidx under a different inGameID (${exists.data.inGameID} != ${inGameID}). Is this a duplicate with a different inGameID?`,
						);

						if (options.force) {
							log.warn("Overwriting anyways, because --force has been requested.");
							exists.data.inGameID = inGameID;
						} else {
							log.warn(
								"Must be resolved manually. Use --force to overwrite anyways.",
							);
						}
					}

					const versionIndex = exists.versions.indexOf(options.version);

					if (versionIndex === -1) {
						exists.versions.push(options.version);
					}

					if (isLatestVersion) {
						if (exists.level !== level) {
							log.info(
								`Chart ${displayName} has had a level change: ${exists.level} -> ${level}.`,
							);
							exists.level = level;
						}

						if (exists.levelNum !== levelNum) {
							log.info(
								`Chart ${displayName} has had a levelNum change: ${exists.levelNum} -> ${levelNum}.`,
							);
							exists.levelNum = levelNum;
						}
					}

					exists.data.displayVersion = displayVersion;

					continue;
				}

				const chartDoc: SEEDS_ChartDocument<"maimaidx"> = {
					id: CreateChartID(),
					legacyChartID: crypto.randomBytes(20).toString("hex"),
					songID: tachiSongID!,
					difficulty: difficultyName as Difficulties["maimaidx"],
					isPrimary: true,
					level,
					levelNum,
					versions: [options.version],
					data: {
						displayVersion,
						inGameID,
					},
				};

				newCharts.push(chartDoc);

				log.info(
					`Inserted new chart ${musicData.artistName.str} - ${musicData.name.str} [${chartDoc.difficulty}] (${chartDoc.id}).`,
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
