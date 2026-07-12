import { log } from "#log";
import { execSync } from "child_process";
/* eslint-disable no-control-regex */
import fs, { mkdirSync } from "fs";
import iconv from "iconv-lite";
import path from "path";
import { type integer } from "tachi-common";

import { ParseDotOneFile } from "./dot-one-parser/parser";
import { type IIDXConvertOutput } from "./dot-one-parser/types";

function readSjisName(b: Buffer, offset: number, length = 0x40): string {
	return iconv.decode(
		b.slice(offset, offset + length).filter((e) => e !== 0) as Buffer,
		"shift_jis",
	);
}

function readAsciiName(b: Buffer, offset: number, length = 0x40): string {
	return b
		.slice(offset, offset + length)
		.filter((e) => e !== 0)
		.toString();
}

function readUtf16Name(b: Buffer, offset: number, length: number): string {
	return b
		.slice(offset, offset + length)
		.toString("utf16le")
		.replace(/\x00/gu, "");
}

// where to store extracted IFS output
const ifsOUT = path.join(__dirname, "./ifs-output");
mkdirSync(ifsOUT, { recursive: true });

/**
 * Extracts an IFS file into the ./ifs-output cache directory.
 */
function ifsExtract(ifsPath: string) {
	log.info(`Extracting ${ifsPath}...`);
	execSync(`ifstools "${ifsPath}" -o "${ifsOUT}" -y --super-disable`, { stdio: "ignore" });
}

// @optimisable
// this can be processed in parallel
// but like. this basically only has to be done once a year.
// https://xkcd.com/1205/
export async function ParseIIDXData(
	basedir: string,
	index: "0" | "1",
	omni: boolean,
	alwaysExtract: boolean,
) {
	log.info(`Parsing from ${basedir}.`);

	const mdbPath = path.join(
		basedir,
		"data/info",
		index,
		omni ? "music_omni.bin" : "music_data.bin",
	);

	log.info(`Parsing MDB ${mdbPath}.`);

	const buffer = fs.readFileSync(mdbPath);

	if (buffer.slice(0, 4).toString() !== "IIDX") {
		throw new Error("Invalid MDB File.");
	}

	let levelsOffset: integer, start: integer, structSize: integer;

	// mdb format: [16 byte header][songID bank][song structs]
	// the length of the 2nd part is (num of available entries * num bytes per songID)
	// so our starting offset for song metadata is that + (header length)

	switch (buffer[4]) {
		case 27:
		case 28:
		case 29:
		case 30:
		case 31:
			start = buffer.readUInt16LE(0xa) * 2 + 0x10;
			structSize = 0x52c;
			levelsOffset = 0x120;
			break;
		case 32:
		case 33:
			start = buffer.readUInt16LE(0xc) * 4 + 0x10;
			structSize = 0x7f8;
			levelsOffset = 0x3ec;
			break;
		default:
			throw new Error("Unknown version of MDB.");
	}

	let moreData = true;

	let curLoc = start;

	const parsedData: Array<IIDXConvertOutput> = [];

	while (moreData) {
		const struct = buffer.slice(curLoc, curLoc + structSize);

		// laziest hack
		const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((e) =>
			struct.readUInt8(levelsOffset + e),
		);

		// remember that i get paid real money to program in this language
		const [spb, spn, sph, spa, spl, _dpb, dpn, dph, dpa, dpl] = levels as [
			number,
			number,
			number,
			number,
			number,
			number, // dpb has nothing defined, or maybe it does, nobody knows, or cares
			number,
			number,
			number,
			number,
		];

		let artist: string,
			folder: integer,
			genre: string,
			marquee: string,
			songID: integer,
			title: string;

		if (buffer[4] < 32) {
			songID = struct.readUInt16LE(0x3b0);
			title = readSjisName(struct, 0x0);
			marquee = readAsciiName(struct, 0x40);
			genre = readSjisName(struct, 0x80);
			artist = readSjisName(struct, 0xc0);
			folder = struct.readUInt8(0x118);
		} else {
			songID = struct.readUInt16LE(0x67c);
			title = readUtf16Name(struct, 0x0, 256);
			marquee = readAsciiName(struct, 0x100);
			genre = readUtf16Name(struct, 0x140, 128);
			artist = readUtf16Name(struct, 0x1c0, 256);
			folder = struct.readUInt8(0x3dc);
		}

		const notecounts: Record<string, number> = {};

		// internal SongID - songIDs are not really an int, and are sometimes prefixed with a 0
		// to fit as a 5 digit string.
		const iSongID = songID < 10_000 ? `0${songID}` : songID.toString();

		// where the IFS for this song might be located
		const ifsPath = path.join(basedir, `data/sound/${iSongID}.ifs`);
		const ifsLeggPath = path.join(basedir, `data/sound/${iSongID}-p0.ifs`);

		// where the dotOne for this file might be located.
		let dotOnePath = path.join(basedir, `data/sound/${iSongID}/${iSongID}.1`);

		// where the dotone file will be after extraction (if necessary)
		const extractedIFSLoc = path.join(ifsOUT, `${iSongID}_ifs/${iSongID}/${iSongID}.1`);

		const extractedIFSLeggLoc = path.join(ifsOUT, `${iSongID}-p0_ifs/${iSongID}/${iSongID}.1`);

		if (fs.existsSync(ifsLeggPath) || fs.existsSync(extractedIFSLeggLoc)) {
			if (!fs.existsSync(extractedIFSLeggLoc) || alwaysExtract) {
				ifsExtract(ifsLeggPath);
			}

			dotOnePath = extractedIFSLeggLoc;

			const charts = await ParseDotOneFile(extractedIFSLeggLoc, {
				genre,
				marquee,
				songArtist: artist,
				songTitle: title,
			});

			for (const chart of charts) {
				notecounts[`${chart.playtype}-${chart.difficulty}`] = chart.notecount;
			}
		} else {
			// if we've already extracted this, and --always-extract isn't set
			if (fs.existsSync(extractedIFSLoc) && !alwaysExtract) {
				dotOnePath = extractedIFSLoc;
			} else if (fs.existsSync(ifsPath)) {
				ifsExtract(ifsPath);

				dotOnePath = extractedIFSLoc;
			}
		}

		if (!fs.existsSync(dotOnePath)) {
			curLoc += structSize;
			if (buffer.length <= curLoc) {
				moreData = false;
			}
			log.error(`${dotOnePath} cannot find file. neither exist.`);
			continue;
		}

		log.debug(`Parsing data/sound/${songID}/${songID}.1`);
		try {
			const charts = await ParseDotOneFile(dotOnePath, {
				genre,
				marquee,
				songArtist: artist,
				songTitle: title,
			});

			for (const chart of charts) {
				const notecount = chart.notecount;

				if (chart.difficulty === "LEGGENDARIA") {
					if (notecount !== 0 && notecounts[`${chart.playtype}-LEGGENDARIA`]) {
						log.warn(
							`${chart.artist} - ${chart.title} has conflicting ${
								chart.playtype
							} LEGGENDARIAs.
INLINE: ${notecount} notes, p0: ${notecounts[`${chart.playtype}-LEGGENDARIA`]} notes.
Picking the INLINE version, as it's likely to be the correct one, but confirm this manually.`,
						);
					}
				}

				notecounts[`${chart.playtype}-${chart.difficulty}`] = notecount;
			}
		} catch (err) {
			log.error(err);
			curLoc += structSize;

			if (buffer.length <= curLoc) {
				moreData = false;
			}

			continue;
		}

		parsedData.push({
			title,
			artist,
			marquee,
			folder,
			genre,
			levels: {
				"SP-BEGINNER": spb,
				"SP-NORMAL": spn,
				"SP-HYPER": sph,
				"SP-ANOTHER": spa,
				"SP-LEGGENDARIA": spl,
				"DP-NORMAL": dpn,
				"DP-HYPER": dph,
				"DP-ANOTHER": dpa,
				"DP-LEGGENDARIA": dpl,
			},
			notecounts,
			songID,
		});

		curLoc += structSize;

		if (buffer.length <= curLoc) {
			moreData = false;
		}
	}

	log.info(`Done parsing.`);

	return parsedData;
}
