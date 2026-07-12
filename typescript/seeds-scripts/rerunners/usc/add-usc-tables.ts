import { Database } from "bun:sqlite";
import { Command } from "commander";
import { parse } from "csv-parse/sync";
import fs from "fs";

import { CreateChartID, ReadCollection, WriteCollection } from "../../util";

// The tables are at https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pubhtml.
// Download as csv using these links:
// us1-14: https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pub?output=csv&gid=1782673801
// us15-18+: https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pub?output=csv&gid=1134382369
// os: https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pub?output=csv&gid=144278610
// us0*: https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pub?output=csv&gid=1456079294
// You must also download the "packages" sheet, which maps song pack names to directories. Pass this using the '-p' option:
// https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vRH1beDh3I76qS-UUppW4_GibEj9bBDgcpO1XM4SrMylnSZYjyPjPYcMuQHaMrB-JGpIdsZtb-0wzmp/pub?output=csv&gid=899058659

const DIFF_MAP = {
	Light: "NOV",
	Challenge: "ADV",
	Extended: "EXH",
	Infinite: "INF",
};

// Imagine if sdvx/ksm players could just copy and paste properly...
function fixBrokenData(tier, title, diff, level, packDir) {
	const tierDiffLevel = `${tier} ${diff} ${level}`;
	if (title === "FALSE" && ["us3 NOV 3", "us9 ADV 9", "us13 EXH 13"].includes(tierDiffLevel)) {
		return ["False", diff, level, `\\${packDir}\\`];
	}
	if (title === "Agitatus" && ["us4 NOV 4", "us11 ADV 11"].includes(tierDiffLevel)) {
		// This is actually a typo in the chart, only for NOV and ADV.
		return [" Agitatus", diff, level, `\\${packDir}\\`];
	}
	if (title === "Amnèhilesie" && ["us6 NOV 6", "us12 ADV 12"].includes(tierDiffLevel)) {
		return ["Amnéhilesie", diff, level, `\\${packDir}\\`];
	}
	if (
		title === 'White Wail -the "X-carols"-' &&
		["os3 EXH 19", "os10 INF 20", "us9 NOV 9", "us16 ADV 16"].includes(tierDiffLevel)
	) {
		return ['White Wail -the "X Carols"-', diff, level, `\\${packDir}\\`];
	}
	if (title === "Re:building ZERO" && tierDiffLevel === "us16 EXH 16") {
		return [title, diff, "17", `\\${packDir}\\`];
	}
	if (title === "Our School Festival!" && tierDiffLevel === "us18 INF 18") {
		// The INF has a weird title, the other diffs are all fine.
		return ["Our School festival", diff, level, `\\${packDir}\\`];
	}
	// We must distinguish between the finale and the non-finale version manually.
	// Why the fuck they set it up like this I will never know.
	if (title === "#curtaincall(finale)" && tierDiffLevel === "os5 INF 20") {
		return [
			"#curtaincall",
			diff,
			level,
			"B4UT&KUOC K-shoot mania Package 2016\\03_BOSS_B4UT\\04_#curtaincall_finale\\",
		];
	}
	if (title === "#curtaincall" && tierDiffLevel === "os9* INF 20") {
		return [
			"#curtaincall",
			diff,
			level,
			"B4UT&KUOC K-shoot mania Package 2016\\03_BOSS_B4UT\\03_#curtaincall\\",
		];
	}
	if (title === "双極のバラキエル" && tierDiffLevel === "os6 INF 20") {
		return [title, diff, "19", `\\${packDir}\\`];
	}
	if (
		(title === "Modern Times Paradox" && tierDiffLevel === "us6 NOV 6") ||
		(title === "Modern Times Paradox[B.B.K. Collabo]" && tierDiffLevel === "os8* INF 20")
	) {
		// These charts are corrupted in USC.
		return null;
	}

	return [title, diff, level, `\\${packDir}\\`];
}

function tableFolder(tierString: string): { level: string; table: string } {
	const match = tierString.match(/^(us|os)(\d{1,2}\+?\*?)$/u);
	if (!match) {
		throw new Error(`Invalid tier string: ${tierString}`);
	}
	return {
		table: match[1],
		level: match[2],
	};
}

const program = new Command();
program.requiredOption("-d, --db <maps.db>");
program.requiredOption("-p, --packages <パッケージ集.csv>");
program.requiredOption("-c, --charts [chartlists.csv...]");

program.parse(process.argv);
const options = program.opts();

const directories: Record<string, string[]> = {};
const packageData = parse(fs.readFileSync(options.packages), { from: 1 });

let currentPack = "";
for (let i = 0; i < packageData.length; i++) {
	const row = packageData[i];
	// first column is this weird star thing we ignore
	if (row[1] !== "") {
		currentPack = row[1];
		directories[currentPack] = [];
	}
	const directory = row[2];

	directories[currentPack].push(directory);
}

const db = new Database(options.db, { readonly: true });

// We could use proper queries to be more efficient,
// but the db isn't really large enough for it to matter...
const dbRows = db.query("SELECT * FROM Charts").all();

const songs = ReadCollection("songs-usc.json");
const charts = ReadCollection("charts-usc.json");
let maxSongId = Math.max(...songs.map((s) => s.id));
const folderIdToSongId = {};

for (const tableFile of options.charts) {
	const tableData = parse(fs.readFileSync(tableFile), { from: 2 });
	for (const chartData of tableData) {
		const [tier, origTitle, ksmDiff, origLevel, pack, _notes] = chartData;
		const origDiff = DIFF_MAP[ksmDiff];
		const packDir = directories[pack];

		const fixedData = fixBrokenData(tier, origTitle, origDiff, origLevel, packDir);
		if (fixedData === null) {
			continue;
		}
		const [title, difficulty, level, pathMatch] = fixedData;

		let dbRowMatches = dbRows.filter(
			(row) =>
				row.title === title &&
				row.diff_shortname === difficulty &&
				row.level === Number(level) &&
				row.path.includes(pathMatch),
		);

		if (dbRowMatches.length === 0) {
			console.log(
				`Couldn't find matching row for ${title} (${difficulty} ${level}) in ${tier}. (From package ${pack})`,
			);
			continue;
		} else if (dbRowMatches.length !== 1) {
			if (
				dbRowMatches.length === 2 &&
				dbRowMatches.filter((row) => row.path.endsWith("data.ksh")).length === 1
			) {
				// These files are an old version of the chart I believe.
				dbRowMatches = dbRowMatches.filter((row) => !row.path.endsWith("data.ksh"));
			} else {
				console.log(dbRowMatches);
				//throw new Error(`Wrong number of matching rows for ${title} (${difficulty} ${level}) in ${tier}`);
			}
		}
		const dbRow = dbRowMatches[0];

		const matchingCharts = charts.filter((chart) => chart.hashSHA1 === dbRow.hash);
		if (matchingCharts.length === 2) {
			for (const chart of matchingCharts) {
				chart.data.tableFolders = [tableFolder(tier)];
			}
		} else if (matchingCharts.length === 0) {
			if (!folderIdToSongId[dbRow.folderid]) {
				const songID = maxSongId + 1;
				maxSongId = songID;
				// May need to change to forward slash depending on OS.
				const splitPath = dbRow.path.split("\\");
				const folderName = splitPath[splitPath.length - 2];
				songs.push({
					id: songID,
					title,
					altTitles: [],
					artist: dbRow.artist,
					data: {},
					searchTerms: [folderName],
				});
				folderIdToSongId[dbRow.folderid] = songID;
			}

			const songID = folderIdToSongId[dbRow.folderid];

			for (const playtype of ["Controller", "Keyboard"]) {
				charts.push({
					chartID: CreateChartID(),
					data: {
						effector: dbRow.effector,
						hashSHA1: dbRow.hash,
						isOfficial: false,
						tableFolders: [tableFolder(tier)],
					},
					difficulty,
					isPrimary: true,
					level,
					// So it doesn't give VF. (Consider changing this.)
					levelNum: 0,
					playtype,

					songID,
					tierlistInfo: {},
					versions: {},
				});
			}
		}
	}
}

WriteCollection("songs-usc.json", songs);
WriteCollection("charts-usc.json", charts);
