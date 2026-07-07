import { log } from "#log";
import * as cheerio from "cheerio";
import { type AnyNode } from "domhandler";
import { type SEEDS_ChartDocument, type SEEDS_SongDocument } from "tachi-common";
import { ReadCollection, WriteCollection } from "../../util";

if (require.main !== module) {
	throw new Error(`This is a script. It should be ran directly from the command line with bun.`);
}

const URL_L12_BASE =
	"https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSUdp6iuEzE8Z5AL1hkoxzLexp89nJnLQMmICm6_MC0_UjCp1ImZFzabcZkvCpK7mcWvm_2t6iYoJRg/pubhtml/sheet?headers=false&gid=";
const URL_L11_BASE =
	"https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSLnjRLdYQ53QgdmKoCvW9zVSgHjBCcGf8iTeEgjiSia4i_4YwR9isSfhxC2kSAq_wWygd_9xGORhk0/pubhtml/sheet?headers=false&gid=";

const TIER_CONFIGS = [
	{
		url: URL_L12_BASE + "1184656976",
		level: 12,
		gauge: "normal",
		format: "columnwise",
	},
	{
		url: URL_L12_BASE + "1277599511",
		level: 12,
		gauge: "hard",
		format: "columnwise",
	},
	// The 11 sheet is out of date - trying to find a better one.
	// {
	// 	url: URL_L11_BASE + "411493762",
	// 	level: 11,
	// 	gauge: "normal",
	// 	format: "rowwise",
	// },
	// {
	// 	url: URL_L11_BASE + "1585306050",
	// 	level: 11,
	// 	gauge: "hard",
	// 	format: "rowwise",
	// },
];

type songInTier = {
	title: string;
	difficulty: string;
	kojinsa: boolean;
};

const KOJINSA_CLASS = "s5";

function editDistance(a: string, b: string) {
	const matrix = [];
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1,
				);
			}
		}
	}
	return matrix[b.length][a.length];
}

function parseTitleAndDiff(text: string) {
	// L12 sheet uses [L]/[H]; L11 sheet uses (L)/(H).
	if (text.endsWith("[L]") || text.endsWith("(L)")) {
		return { title: text.slice(0, -3).trim(), difficulty: "LEGGENDARIA" };
	}
	if (text.endsWith("[H]") || text.endsWith("(H)")) {
		return { title: text.slice(0, -3).trim(), difficulty: "HYPER" };
	}
	return { title: text.trim(), difficulty: "ANOTHER" };
}

// NFKC folds fullwidth ASCII/digits to halfwidth (１ -> 1, ＋ -> +); the regex
// passes then collapse curly quotes which NFKC leaves as stylistic variants.
function normalize(s: string) {
	return s.normalize("NFKC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function findMatchingSong(title: string, songsData: SEEDS_SongDocument<"iidx">[]) {
	const waveDashed = title.replaceAll("～", "〜");
	const normalizedClean = normalize(waveDashed);

	for (const song of songsData) {
		if (normalize(song.title) === normalizedClean) {
			return song;
		}
	}

	const lowerTitle = normalizedClean.toLowerCase();
	let bestMatch = null;
	let bestDistance = Infinity;
	const maxDistance = 4;

	for (const song of songsData) {
		const distance = editDistance(lowerTitle, normalize(song.title).toLowerCase().trim());
		if (distance <= maxDistance && distance < bestDistance) {
			bestDistance = distance;
			bestMatch = song;
		}
	}

	if (bestMatch === null) {
		return null;
	}
	if (bestDistance > 0) {
		log.info(`Fuzzy match: "${title}" -> "${bestMatch.title}" (distance: ${bestDistance})`);
	}
	return bestMatch;
}

function isRedSpan(node: AnyNode) {
	if (node.type !== "tag" || node.name !== "span") {
		return false;
	}
	const style = node.attribs?.style || "";
	return /color\s*:\s*#ff0000/i.test(style);
}

// Walks a <td>, returning [{title, difficulty, kojinsa}] split on <br>.
// Any text encountered inside a red <span> marks its segment kojinsa=true.
function parseCell(cellEl: AnyNode) {
	const titles: songInTier[] = [];
	let buffer = "";
	let bufferIsRed = false;

	function flush() {
		const t = buffer.trim();
		if (t.length > 0) {
			const { title, difficulty } = parseTitleAndDiff(t);
			titles.push({ title: title, difficulty: difficulty, kojinsa: bufferIsRed });
		}
		buffer = "";
		bufferIsRed = false;
	}

	function walk(nodes: AnyNode[], redContext: boolean) {
		for (const node of nodes) {
			if (node.type === "text") {
				buffer += node.data;
				if (redContext) {
					bufferIsRed = true;
				}
				continue;
			}
			if (node.type !== "tag") {
				continue;
			}
			if (node.name === "br") {
				flush();
				continue;
			}
			if (isRedSpan(node)) {
				walk(node.children, true);
				continue;
			}
			walk(node.children, redContext);
		}
	}
	if (cellEl.type === "tag") {
		walk(cellEl.children, false);
	}
	flush();
	return titles;
}

async function fetchSheet(url: string) {
	log.info(`Fetching ${url}`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} fetching ${url}`);
	}
	return res.text();
}

function cleanTierName(text: string) {
	return text.trim().replaceAll("＋", "+");
}

// L12 layout: thead shim, then one tier-header row + one data row in tbody.
// Each data <td> holds <br>-separated titles; red <span>s mark 個人差.
function extractTiersColumnwise(html: string) {
	const $ = cheerio.load(html);
	const rows = $("tr").toArray();
	if (rows.length < 3) {
		throw new Error(`Expected at least 3 rows, got ${rows.length}`);
	}

	const headerCells = $(rows[1]).find("td").toArray();
	const tierCells = $(rows[2]).find("td").toArray();

	const colCount = Math.min(headerCells.length, tierCells.length);
	if (headerCells.length !== tierCells.length) {
		log.info(
			`Warning: header has ${headerCells.length} cols, data has ${tierCells.length} cols`,
		);
	}

	const tiers = [];
	for (let k = 0; k < colCount; k++) {
		const tierName = cleanTierName($(headerCells[k]).text());
		const songsInTier = parseCell(tierCells[k]);
		tiers.push({ tier: tierName, songsInTier });
	}
	return tiers;
}

// L11 layout: thead shim, then in tbody: title row, tier-header row, then one
// song per cell per row. Empty cell = tier ran out of songs. 個人差 cells
// carry class "s5" on the <td>.
function extractTiersRowwise(html: string) {
	const $ = cheerio.load(html);
	const rows = $("tr").toArray();
	if (rows.length < 4) {
		throw new Error(`Expected at least 4 rows, got ${rows.length}`);
	}

	const headerCells = $(rows[2]).find("td").toArray();
	const tiers = headerCells.map((c) => ({
		tier: cleanTierName($(c).text()),
		songsInTier: [] as songInTier[],
	}));

	for (let k = 3; k < rows.length; k++) {
		const cells = $(rows[k]).find("td").toArray();
		const colCount = Math.min(tiers.length, cells.length);
		for (let col = 0; col < colCount; col++) {
			const cell = $(cells[col]);
			const text = cell.text().trim();
			if (text.length === 0) {
				continue;
			}
			const cls = cell.attr("class") || "";
			const kojinsa = cls.split(/\s+/).includes(KOJINSA_CLASS);
			const { title, difficulty } = parseTitleAndDiff(text);
			tiers[col].songsInTier.push({ title: title, difficulty: difficulty, kojinsa: kojinsa });
		}
	}
	return tiers;
}

function applyTiers(
	chartsData: SEEDS_ChartDocument<"iidx-sp">[],
	songsData: SEEDS_SongDocument<"iidx">[],
	level: number,
	tiers: {
		tier: string;
		songsInTier: songInTier[];
	}[],
	field: "hcTier" | "ncTier",
) {
	let updated = 0;
	let notFound = 0;

	function tierToValue(tier: string) {
		switch (tier) {
			case "S+":
				return level + 1.2;
			case "S":
				return level + 1.0;
			case "A+":
				return level + 0.9;
			case "A":
				return level + 0.8;
			case "B+":
				return level + 0.7;
			case "B":
				return level + 0.6;
			case "C":
				return level + 0.4;
			case "D":
				return level + 0.2;
			case "E":
				return level + 0.0;
			case "F":
				return level - 0.2;
			default:
				return level;
		}
	}

	function isInAc(versions: string[]) {
		for (const version of ["33", "32", "31", "30"]) {
			if (versions.includes(version)) return true;
		}
		return false;
	}

	for (const { tier, songsInTier } of tiers) {
		if (!tier || tier === "未定" || tier === "超個人差") {
			continue;
		}
		for (const { title, difficulty, kojinsa } of songsInTier) {
			const songMatch = findMatchingSong(title, songsData);
			if (!songMatch) {
				log.warn(`No match: ${title}`);
				notFound++;
				continue;
			}
			let chartFound = false;
			for (const chart of chartsData) {
				if (
					chart.songID === songMatch.id &&
					chart.difficulty === difficulty &&
					chart.data["2dxtraSet"] === null &&
					isInAc(chart.versions)
				) {
					chart.data[field] = {
						individualDifference: kojinsa,
						text: level + tier,
						value: tierToValue(tier),
					};
					updated++;
					chartFound = true;
					break;
				}
			}
			if (!chartFound) {
				log.warn(`Chart not found: ${songMatch.title} (SP ${difficulty})`);
				notFound++;
				continue;
			}
		}
	}
	return { updated, notFound };
}

async function main() {
	const chartsData = ReadCollection("charts-iidx-sp.json");
	const songsData = ReadCollection("songs-iidx.json");

	for (const config of TIER_CONFIGS) {
		log.info(`Processing L${config.level} ${config.gauge}`);
		const html = await fetchSheet(config.url);
		const tiers =
			config.format === "rowwise" ? extractTiersRowwise(html) : extractTiersColumnwise(html);
		log.info(`Parsed ${tiers.length} tiers: ${tiers.map((t) => t.tier).join(", ")}`);
		const { updated, notFound } = applyTiers(
			chartsData,
			songsData,
			config.level,
			tiers,
			config.gauge === "normal" ? "ncTier" : "hcTier",
		);
		log.info(`L${config.level} ${config.gauge}: ${updated} updated, ${notFound} not found`);
	}
	WriteCollection("charts-iidx-sp.json", chartsData);
}

main().catch((err) => {
	console.error(`ERROR: ${err.message}`);
	process.exit(1);
});
