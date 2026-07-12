import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { FindChartWithPTDFVersion, FindSongWithTitle } from "../../../finders.js";
import { ApplyMutations } from "../../../mutations.js";
import { ReadCollection } from "../../../util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const songs = ReadCollection("songs-iidx.json");

async function parseKr(file, mode, catVals) {
	const charts = ReadCollection("charts-iidx.json");

	const krdata = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf-8"));
	const mutations = [];

	for (let i = 0; i < krdata.categories.length; i++) {
		const data = krdata.categories[i];
		if (data.sortindex < 0) {
			continue;
		}

		const cv = catVals[i];

		if (!cv) {
			throw new Error(`cv krdata mismatch ${krdata.categories.length} ${catVals.length}?`);
		}

		for (const item of data.items) {
			const formattedTitle = item.data.title.replace(/†$/u, "").trim();
			const song = FindSongWithTitle(songs, formattedTitle);

			if (!song) {
				console.warn(`Could not find song with title ${item.data.title}`);
				continue;
			}

			const t = item.data.type;

			let diff;
			if (t === "A") {
				diff = "ANOTHER";
			} else if (t === "L") {
				diff = "LEGGENDARIA";
			} else if (t === "H") {
				diff = "HYPER";
			} else if (t === "N") {
				diff = "NORMAL";
			} else {
				console.warn(`${song.title} Unknown difficulty ${t}.`);
				continue;
			}

			const chart = await FindChartWithPTDFVersion(charts, song.id, "SP", diff, "30");

			if (!chart) {
				console.warn(`${song.title} ${diff} - Couldn't find chart?`);
				continue;
			}

			// Update this part of the tierlist, we've got everything.

			mutations.push({
				data: {
					data: {
						[mode]: {
							individualDifference: cv.idv,
							text: cv.text,
							value: cv.value,
						},
					},
				},
				match: {
					chartID: chart.chartID,
				},
			});

			console.log(`Updated ${chart.chartID} to value ${cv.value}.`);
		}
	}

	console.info(`Finished parsing ${file}`);

	ApplyMutations("charts-iidx.json", mutations);
}

function h(text, value, idv = false) {
	return { idv, text, value };
}

parseKr("sp11N.json", "ncTier", [
	h("11S+", 12.2),
	h("11S", 12),
	h("11A+", 11.9),
	h("11A", 11.8),
	h("11B", 11.6),
	h("11C", 11.4),
	h("11D", 11.2),
	h("11E", 11.0),
	h("11F", 10.8),
]);

parseKr("sp11H.json", "hcTier", [
	h("11S+", 12.2),
	h("11S+", 12.2, true), // 個人差
	h("11S", 12.0),
	h("11S", 12.0, true), // 個人差
	h("11S-", 11.95),
	h("11S-", 11.95, true), // 個人差
	h("11A+", 11.9),
	h("11A+", 11.9, true), // 個人差
	h("11A", 11.8),
	h("11A", 11.8, true), // 個人差
	h("11B+", 11.7),
	h("11B+", 11.7, true),
	h("11B", 11.6),
	h("11B", 11.6, true),
	h("11C", 11.4),
	h("11C", 11.4, true),
	h("11D", 11.2),
	h("11E", 11.0),
	h("11F", 10.8),
]);
