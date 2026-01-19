/* eslint-disable no-await-in-loop */

import { ReadCollection, WriteCollection } from "../../util";
import { ChartDocument, SongDocument } from "tachi-common";
import readline from "readline";

type OngekiChart = ChartDocument<"ongeki:Single">;
type OngekiSong = SongDocument<"ongeki">;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (query: string) => new Promise((resolve) => rl.question(query, resolve));

const convertDiffToLink = (diff: string) => {
	switch (diff) {
		case "A":
			return "adv";
		case "E":
			return "exp";
		case "M":
		case "":
			return "mst";
		case "L":
			return "luna";
		default:
			throw new Error(`Invalid diff ${diff}`);
	}
};

const convertDiffProper = (diff: string) => {
	switch (diff) {
		case "A":
			return "ADVANCED";
		case "E":
			return "EXPERT";
		case "M":
		case "":
			return "MASTER";
		case "L":
			return "LUNATIC";
		default:
			throw new Error(`Invalid diff ${diff}`);
	}
};

const decodeHTML = (encodedString: string | undefined) =>
	(encodedString ?? "").replace(/&#(\d+);/giu, (_, numStr) => {
		const num = parseInt(numStr, 10);
		return String.fromCharCode(num);
	});

const scrape = async (url: string, allCharts: OngekiChart[], allSongs: OngekiSong[]) => {
	const html = await (await fetch(url)).text();
	for (const line of html.split("\n")) {
		if (!line.startsWith("<script ") || line.includes("common.js")) {
			continue;
		}

		// Most titles are put in a comment at the end of the line
		// Extract [full match, title]
		const titleM = line.match(/<!--(.*)-->/u);

		// Extract [full match, 5-digit code, difficulty letter]
		const diffM = line.match(/<script>SORT(\d{5})(.*)\(\);<\/script>/u);

		// Extract [full match, link to the js file, directory (01/02/etc./luna), 5-digit code]
		const linkM = line.match(
			/<script src="(\/ongeki\/([^/]+)\/js\/(\d{5})(?:sort|luna)\.js)"><\/script>/u
		);

		// Verify match counts exactly, and cross-check the 5-digit code between diffM and linkM
		if (
			titleM?.length !== 2 ||
			diffM?.length !== 3 ||
			linkM?.length !== 4 ||
			diffM[1] !== linkM[3]
		) {
			console.error(
				`Invalid line: ${line} / ${titleM?.length} ${diffM?.length} ${linkM?.length}`
			);
			continue;
		}

		const [, title] = titleM;
		const [, , diff] = diffM;
		const [, linkJs, link1, link2] = linkM;

		let songs = allSongs.filter((s) => s.title === title);

		// Try another method if the commented title doesn't match
		if (songs.length === 0) {
			const html = await (await fetch(`https://sdvx.in/${linkJs}`)).text();
			const [titleRaw] = html.split("\n");
			const title = titleRaw!.match(/<div class=f.>(.*)<\/div>/u);
			songs = allSongs.filter((s) => s.title === decodeHTML(title![1]));
		}

		if (songs.length === 0) {
			console.error(`Unknown song: ${title}`);
			continue;
		}

		const link = `https://sdvx.in/ongeki/${link1}/${link2}${convertDiffToLink(diff!)}.htm`;

		if (songs.length > 1) {
			console.error(`Multiple matches: ${title}`);
			continue;
		}

		const song = songs[0]!;
		const properDiff = convertDiffProper(diff!);
		const chart = allCharts.find((c) => c.songID === song.id && c.difficulty === properDiff);

		if (chart) {
			chart.data.chartViewURL = link;
			console.log(`${title} ${properDiff}: ${link}`);
		} else {
			console.error(`Unknown chart: ${title} ${properDiff}`);
		}
	}
};

const scrapeAll = async (charts: OngekiChart[], songs: OngekiSong[]) => {
	for (const diff of ["11", "11+", "12", "12+", "13", "13+", "14", "14+", "15", "0"]) {
		await scrape(`https://sdvx.in/ongeki/sort/${diff}.htm`, charts, songs);
	}
	await scrape("https://sdvx.in/ongeki/del.htm", charts, songs);

	WriteCollection("charts-ongeki.json", charts);
};

const listMissing = async (charts: OngekiChart[], songs: OngekiSong[], minLevel: number) => {
	for (const chart of charts) {
		if (chart.data.inGameID >= 7000 && chart.data.inGameID < 8000) {
			// Bonus track
			continue;
		}
		if (chart.levelNum >= minLevel && !chart.data.chartViewURL) {
			const song = songs.find((s) => s.id === chart.songID);
			// @ts-ignore The linter disagrees with the compiler
			chart.data.chartViewURL = await prompt(
				`Missing: ${song?.artist} ${song?.title} ${chart.difficulty} ${chart.level}\n`
			);
			WriteCollection("charts-ongeki.json", charts);
		}
	}
};

const main = async () => {
	const charts: OngekiChart[] = ReadCollection("charts-ongeki.json");
	const songs: OngekiSong[] = ReadCollection("songs-ongeki.json");

	if (process.argv[process.argv.length - 1] !== "--list") {
		await scrapeAll(charts, songs);
	}
	await listMissing(charts, songs, 12.7); // Charts below 12+ are whatever

	rl.close();
};

main();
