import { Command } from "commander";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

import { log as logger } from "../../log.ts";
import { MutateCollection, ReadCollection } from "../../util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program.option("-f, --fetch", "Fetch the latest data from the poyashi repo.");

program.parse(process.argv);
const options = program.opts();

const dataLoc = path.join(__dirname, "./bpi-output.json");

const difficultyResolve = {
	3: ["SP", "HYPER"],
	4: ["SP", "ANOTHER"],
	8: ["DP", "HYPER"],
	9: ["DP", "ANOTHER"],
	10: ["SP", "LEGGENDARIA"],
	11: ["DP", "LEGGENDARIA"],
};

async function UpdatePoyashiData() {
	let data;
	if (options.fetch) {
		logger.info("Fetching data from proxy...");
		const rj = await fetch("https://proxy.poyashi.me/?type=bpi").then((r) => r.json());

		logger.info("Fetched data.");
		fs.writeFileSync(dataLoc, JSON.stringify(rj));
		logger.info("Saved data to output.json.");

		data = rj;
	} else {
		logger.info("Reading data from output.json...");
		data = JSON.parse(fs.readFileSync(dataLoc, "utf-8"));
	}

	for (const d of data.body) {
		const res = difficultyResolve[d.difficulty];

		if (!res) {
			throw new Error(`Unknown difficulty ${d.difficulty}`);
		}

		const [playtype, diff] = res;

		const tachiSong = FindSongOnTitle(d.title);

		if (!tachiSong) {
			logger.warn(`Cannot find song ${d.title}?`);
			continue;
		}

		const tachiChart = await FindChartWithPTDFVersion(tachiSong.id, playtype, diff, "29");

		if (!tachiChart) {
			logger.warn(
				`Cannot find chart ${tachiSong.title} (${tachiSong.id}) ${playtype}, ${diff}?`,
			);
			continue;
		}

		const kavg = Number(d.avg);

		if (kavg < 0) {
			logger.warn(
				`${tachiSong.title} (${playtype} ${diff}). Invalid kavg ${d.avg}, Skipping.`,
			);
			continue;
		}

		if (d.removed) {
			logger.info(`Skipping removed chart ${tachiSong.title}.`);
			continue;
		}

		tachiChart.data.bpiCoefficient = d.coef === -1 || d.coef === undefined ? null : d.coef;
		tachiChart.data.kaidenAverage = Number(d.avg);
		tachiChart.data.worldRecord = Number(d.wr);
	}

	MutateCollection("charts-iidx.json", () => chartData);

	logger.info(`Done.`);
}

const songData = ReadCollection("songs-iidx.json");
const chartData = ReadCollection("charts-iidx.json");

function FindSongOnTitle(title) {
	for (const data of songData) {
		if (data.title === title || data.altTitles.includes(title)) {
			return data;
		}
	}

	return null;
}

function FindChartWithPTDFVersion(songID, playtype, diff, version) {
	for (const chart of chartData) {
		if (
			chart.song.id === songID &&
			chart.playtype === playtype &&
			chart.difficulty === diff &&
			chart.versions.includes(version)
		) {
			return chart;
		}
	}

	return null;
}

if (require.main === module) {
	UpdatePoyashiData();
}
