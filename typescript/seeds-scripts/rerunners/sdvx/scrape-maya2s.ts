/* eslint-disable no-await-in-loop */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { type ChartDocument, type SongDocument } from "tachi-common";

import { ReadCollection, WriteCollection } from "../../util";

type SDVXChart = ChartDocument<"sdvx">;
type SDVXSong = SongDocument<"sdvx">;

// Internal data for PUC tierlists are inconsistent
const MANUAL_PUC_TIERS: { [level: number]: { [tier: string]: string } } = {
	16: {
		0: "16.?",
		1: "16.0",
		2: "16.1",
		3: "16.2",
		4: "16.3",
		5: "16.4",
		6: "16.5",
		7: "16.6",
		8: "16.7",
		9: "16.8",
		10: "16.9",
		11: "16.999",
		12: "16.?",
	},
	17: {
		10: "18.0",
	},
	19: {
		0: "19.13",
		1: "19.12",
		2: "19.11",
		3: "19.10",
		4: "19.9",
		5: "19.8",
		6: "19.7",
		7: "19.6",
		8: "19.5",
		9: "19.4",
		10: "19.3",
		11: "19.2",
		12: "19.1",
		13: "19.0",
		14: "19.?",
	},
	20: {
		0: "20.7",
		1: "20.6",
		2: "20.5",
		3: "20.4",
		4: "20.3",
		5: "20.2",
		6: "20.1",
		7: "20.0",
		8: "20.?",
	},
};

// Used for tierlist value sorting
const MANUAL_PUC_VALUES: { [tierText: string]: number } = {
	// ".?" values indicate individual difference and should appear at the bottom of their tierlists
	"16.?": 15.9,
	"19.?": 18.9,
	"20.?": 19.9,
	// To avoid these tiers getting grouped with 19.1
	"19.10": 20.0,
	19.11: 20.1,
	19.12: 20.2,
	19.13: 20.3,
};

// Tier 0+ and Tier 0- for the Lvl 19/20 tierlist are internally named -1 and 0
// respectively, so map them back to the display names
const MANUAL_S_TIERS: { [level: number]: { [tier: string]: string } } = {
	19: {
		"-1": "0+",
		0: "0-",
	},
};

function normalizeStr(s: string) {
	return s.toLowerCase().replace(/ /gu, "");
}

async function scrape(
	url: string,
	charts: SDVXChart[],
	songs: SDVXSong[],
	level: number,
	tierlistType: "PUC_LAMP" | "S_RANK",
) {
	const html = await fetch(url).then((r) => r.text());
	const $ = cheerio.load(html);

	for (const tierBox of $(".tier_box")) {
		const tier = tierBox.attribs["data-tier"];

		// Songs under this tier are not yet rated
		if (!tier || tier === "999") {
			continue;
		}

		const tierText =
			tierlistType === "S_RANK"
				? `T${MANUAL_S_TIERS[level]?.[tier] ?? tier}`
				: (MANUAL_PUC_TIERS[level]?.[tier] ?? `${level}.${tier}`);

		for (const chartData of $(tierBox).find(".chart_data")) {
			const title = chartData.attribs["data-title"] || "";
			const artist = chartData.attribs["data-artist"] || "";
			const song = songs.find(
				(s) =>
					normalizeStr(s.artist) === normalizeStr(artist) &&
					(normalizeStr(s.title) === normalizeStr(title) || s.altTitles.includes(title)),
			);

			if (!song) {
				console.error(`[Unknown Song] ${title} - ${artist}`);

				continue;
			}

			const diff = chartData.attribs["data-diff_type"];
			const chart = charts.find((c) => c.songID === song.id && c.difficulty === diff);

			if (!chart) {
				console.error(`[Unknown Chart] ${title} - ${artist} [${diff}]`);

				continue;
			}

			// S_RANK value is derived since the S tierlist groups charts under Tier 1, Tier 2, etc.
			// instead of 17.3, 17.4, etc. like the PUC tierlist
			// Example: Level 17 Tier 9 -> 17 + 1 - 9 / 10 = 17.1
			const value =
				tierlistType === "S_RANK"
					? level + 1 - parseInt(tier, 10) / 10
					: (MANUAL_PUC_VALUES[tierText] ?? Number(tierText));
			const individualDifference = tierText.includes("?");
			const tierInfoKey: keyof SDVXChart["data"] =
				tierlistType === "S_RANK" ? "sTier" : "pucTier";

			if (chart.data[tierInfoKey]) {
				const tierInfo = chart.data[tierInfoKey]!;

				if (
					tierInfo.text !== tierText ||
					tierInfo.value !== value ||
					tierInfo.individualDifference !== individualDifference
				) {
					console.log(
						`[${chart.data[tierInfoKey]!.text} (${chart.data[tierInfoKey]!.value})
					} -> ${tierText} (${value})]: ${title} - ${artist} [${diff}]`,
					);
				}
			} else {
				console.log(`[${tierText} (${value})] ${title} - ${artist} [${diff}]`);
			}

			chart.data[tierInfoKey] = {
				individualDifference,
				text: tierText,
				value,
			};
		}
	}
}

async function main() {
	const charts: SDVXChart[] = ReadCollection("charts-sdvx.json");
	const songs: SDVXSong[] = ReadCollection("songs-sdvx.json");

	for (const level of [17, 18, 19]) {
		console.log(`\n[S Rank] Scraping Level ${level}`);

		await scrape(
			`https://sdvx.maya2silence.com/table/${level}`,
			charts,
			songs,
			level,
			"S_RANK",
		);
	}

	for (const level of [16, 17, 18, 19, 20]) {
		console.log(`\n[PUC Lamp] Scraping Level ${level}`);

		await scrape(
			`https://sdvx.maya2silence.com/table/${level}p`,
			charts,
			songs,
			level,
			"PUC_LAMP",
		);
	}

	WriteCollection("charts-sdvx.json", charts);
}

main();
