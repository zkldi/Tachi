/* eslint-disable no-await-in-loop */
import { Command, InvalidArgumentError } from "commander";
import { XMLParser } from "fast-xml-parser";
import { type PathLike } from "fs";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type ChartDocument, type SongDocument } from "tachi-common";

import { ReadCollection, WriteCollection } from "../../util";

const execFileAsync = promisify(execFile);

const command = new Command()
	.requiredOption("-v, --vgms <path-to-vgmstream-cli>")
	.requiredOption("-d, --data <path-with-AXXX>")
	.requiredOption("-g, --game <ongeki|chunithm>")
	.parse(process.argv);

const options = command.opts();
const vgmsPath = options.vgms;
const optPath = options.data;
const game = options.game;

const readOpt = async (
	musicPath: string,
	charts: ChartDocument<"chunithm" | "ongeki">[],
	songs: SongDocument<"chunithm" | "ongeki">[],
) => {
	let musicDir: string[];
	try {
		musicDir = await fs.readdir(musicPath);
	} catch (_) {
		// musicless opt, most likely
		return;
	}

	const parser = new XMLParser();
	for (const songPath of musicDir) {
		const p = path.join(musicPath, songPath);
		if (!(await fs.stat(p)).isDirectory()) {
			console.log(`${p}: not a directory`);
			continue;
		}
		const songDir = await fs.readdir(p);
		for (const f of songDir) {
			if (f === "Music.xml") {
				const parsed = parser.parse(await fs.readFile(path.join(p, f)));

				let sourceId;
				let id;
				if (game === "ongeki") {
					sourceId = parsed.MusicData.MusicSourceName.id;
					id = parsed.MusicData.Name.id;
				} else {
					sourceId = parsed.MusicData.cueFileName.id;
					id = parsed.MusicData.name.id;
				}

				const chart = charts.find((c) => c.data.inGameID === id);
				if (chart === undefined) {
					if (!(game === "chunithm" && id >= 8000)) {
						console.error(`Song #${id}: not present in the seeds`);
					}
					continue;
				}
				const song = songs.find((s) => s.id === chart.song.id);
				if (song === undefined) {
					console.error(`Song #${id}: orphan`);
					continue;
				}

				if ("duration" in song.data) {
					continue;
				}

				const padded4 = `${sourceId}`.padStart(4, "0");
				const padded6 = `${sourceId}`.padStart(6, "0");
				let cuePath: PathLike;
				if (game === "ongeki") {
					cuePath = path.join(
						p,
						"..",
						"..",
						"musicsource",
						`musicsource${padded4}`,
						`music${padded4}.awb`,
					);
				} else {
					cuePath = path.join(
						p,
						"..",
						"..",
						"cueFile",
						`cueFile${padded6}`,
						`music${padded4}.awb`,
					);
				}

				try {
					await fs.stat(cuePath);
				} catch (_) {
					console.error(`Song ${id}: MISSING (expected: ${cuePath}) [${song.title}]`);
					continue;
				}

				const { stdout } = await execFileAsync(vgmsPath, ["-m", "-I", cuePath]);

				try {
					const res = JSON.parse(stdout);

					if (res.sampleRate !== 48000) {
						console.log(`Warning: Song #${id}'s sample rate is ${res.sampleRate}Hz`);
					}

					const duration = res.numberOfSamples / res.sampleRate;

					song.data.duration = Number(duration.toFixed(3));
					console.log(`Song #${id}: ${song.data.duration}`);
				} catch (e) {
					console.error(`Song #${id}: Error parsing vgmstream output: ${stdout}`);
					continue;
				}
			}
		}
	}
};

const main = async () => {
	if (game !== "ongeki" && game !== "chunithm") {
		throw new InvalidArgumentError("Bad game");
	}
	const charts = ReadCollection(`charts-${game}.json`);
	const songs = ReadCollection(`songs-${game}.json`);
	const dir = await fs.readdir(optPath);
	const promises: Promise<void>[] = [];
	for (const opt of dir) {
		if (opt.startsWith("A") && opt.length === 4) {
			promises.push(readOpt(path.join(optPath, opt, "music"), charts, songs));
		}
	}

	await Promise.all(promises);

	WriteCollection(`songs-${game}.json`, songs);
};

main();
