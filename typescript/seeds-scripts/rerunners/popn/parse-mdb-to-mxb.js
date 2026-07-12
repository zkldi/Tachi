import { Command } from "commander";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import iconv from "iconv-lite";
import path from "path";

const program = new Command();
program
	.option("-m, --mdb <mdb folder>") // refers to the multixml mdb exported with popnhax_tools
	.option("-d, --data <root of popn install>"); // refers to the "contents" folder of your install. you MUST have unpacked every ifs file inside of contents/data/sd with ifstools before running this script.
program.parse(process.argv);
const options = program.opts();

if (!options.mdb || !options.data) {
	throw new Error("Missing options --mdb or --data.");
}

const parser = new XMLParser({ ignoreAttributes: false });
const mdbs = [];
const files = fs.readdirSync(options.mdb);
for (const file of files) {
	const mdb = fs.readFileSync(path.join(options.mdb, file));
	const decr = iconv.decode(Buffer.from(mdb), "Shift_JIS");
	const parsed = parser.parse(decr);
	mdbs.push(parsed);
}

const mxb = [];

function getDiffForIdx(idx) {
	switch (idx) {
		case "ep":
			return "Easy";
		case "hp":
			return "Hyper";
		case "np":
			return "Normal";
		case "op":
			return "EX";
		default:
			throw new Error("Unknown idx parsed");
	}
}
const valid_diffs = ["ep", "np", "hp", "op"];

function getSha256ForChart(filename, folder, idx) {
	// Check if there's a patched version first
	let filepath = path.join(
		options.data,
		"data",
		"sd",
		folder,
		`${filename}_diff_ifs`,
		`${filename}_${idx}.bin`,
	);
	if (!fs.existsSync(filepath)) {
		filepath = path.join(
			options.data,
			"data",
			"sd",
			folder,
			`${filename}_ifs`,
			`${filename}_${idx}.bin`,
		);
	}

	if (filename === "tour" && idx === "op") {
		// silly workaround for one song which is in another directory for no fucking reason
		filepath = path.join(
			options.data,
			"data",
			"sd",
			folder,
			`${filename}_diff_ifs`,
			`${filename}_${idx}.bin`,
		);
	}

	const input = fs.readFileSync(filepath);
	const hash = crypto.createHash("sha256");
	hash.update(input);
	return hash.digest("hex");
}

for (const mdb of mdbs) {
	for (const song of mdb.database.music) {
		if (song.charts.chart && song.charts.chart.length > 0) {
			// skip entries with no charts
			const charts = [];
			for (const chart of song.charts.chart) {
				if (valid_diffs.includes(chart["@_idx"])) {
					// shouldn't include battle charts
					const chartHash = getSha256ForChart(
						chart.filename["#text"],
						chart.folder["#text"],
						chart["@_idx"],
					);
					charts.push({
						difficulty: getDiffForIdx(chart["@_idx"]),
						filename: `${chart.filename["#text"]}`,
						hash: chartHash,
						level: Number(chart.diff["#text"]),
					});
				}
			}
			mxb.push({
				artist: `${song.artist["#text"]}`,
				charts,
				genre: `${song.genre["#text"]}`,
				music_entry: Number(song["@_id"]),
				title: `${song.title["#text"]}`,
			});
		}
	}
}

fs.writeFileSync("mxb.json", JSON.stringify(mxb));
