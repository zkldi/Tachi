import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function ChartSort(a, b) {
	// sink all 2dxtra charts to the bottom
	if (b.data?.["2dxtraSet"] !== null && a.data?.["2dxtraSet"] === null) {
		return -1;
	}

	if (a.data?.["2dxtraSet"] !== null && b.data?.["2dxtraSet"] === null) {
		return 1;
	}

	// TODO(zk): temp, during v3 migration this
	// sort script needs to support
	// both formats.
	if (typeof a.songID === "string" && typeof b.songID === "string") {
		if (a.songID !== b.songID) {
			return a.songID.localeCompare(b.songID);
		}
	} else if (a.songID !== b.songID) {
		return a.songID - b.songID;
	}

	// TODO(zk): temp, during v3 migration this
	// sort script needs to support
	// both formats.
	if (a.playtype && b.playtype && a.playtype !== b.playtype) {
		return a.playtype.localeCompare(b.playtype);
	}

	if (a.difficulty !== b.difficulty) {
		return a.difficulty.localeCompare(b.difficulty);
	}

	return 0;
}

function FolderSort(a, b) {
	if (a.game !== b.game) {
		return a.game.localeCompare(b.game);
	}

	return a.title.localeCompare(b.title);
}

function TableSort(a, b) {
	if (a.game !== b.game) {
		return a.game.localeCompare(b.game);
	}

	return a.title.localeCompare(b.title);
}

function BMSCourseSort(a, b) {
	if (a.game !== b.game) {
		return a.game.localeCompare(b.game);
	}

	if (a.set !== b.set) {
		return a.set.localeCompare(b.set);
	}

	if (a.value !== b.value) {
		return a.value - b.value;
	}

	return a.md5sums.localeCompare(b.md5sums);
}

/**
 * Deterministic sorting + stable key ordering; JSON is written with tab indentation only.
 * @param {{ checkOnly?: boolean }} [opts] — when `checkOnly`, compare to disk and do not write; exit handled by caller via return value.
 * @returns {boolean} — `true` if all serialized collections match disk (always when not `checkOnly`); `false` if `checkOnly` and any file would change.
 */
function SortSeeds(opts = {}) {
	const { checkOnly = false } = opts;

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	const collectionsDir = path.join(__dirname, "../../db/seeds");
	const collections = fs.readdirSync(collectionsDir).filter((name) => name.endsWith(".json"));

	let allMatch = true;

	for (const collection of collections) {
		const collPath = path.join(collectionsDir, collection);
		let content = JSON.parse(fs.readFileSync(collPath, "utf8"));

		// Auxiliary maps (non-array roots) coexist with seed collections — skip them.
		if (!Array.isArray(content)) {
			continue;
		}

		if (collection.startsWith("charts-")) {
			content.sort(ChartSort);
		} else if (collection.startsWith("songs-")) {
			content.sort((a, b) => {
				if (typeof a.id === "number" && typeof b.id === "number") {
					return a.id - b.id;
				}

				return (a.id ?? "").localeCompare(b.id ?? "");
			});
		} else if (collection.startsWith("folders")) {
			content.sort(FolderSort);
		} else if (collection.startsWith("tables")) {
			content.sort(TableSort);
		} else if (collection.startsWith("bms-course-lookup.json")) {
			content.sort(BMSCourseSort);
		}

		content = content.map(SortObjectKeys);

		const serialized = JSON.stringify(content, null, "\t");

		if (checkOnly) {
			const onDisk = fs.readFileSync(collPath, "utf8");
			if (onDisk !== serialized) {
				allMatch = false;
			}
		} else {
			fs.writeFileSync(collPath, serialized);
		}
	}

	return allMatch;
}

function SortObjectKeys(object) {
	const newObject = {};

	for (const key of Object.keys(object).sort()) {
		let v = object[key];

		if (typeof v === "object" && v && !Array.isArray(v)) {
			v = SortObjectKeys(v);
		}

		newObject[key] = v;
	}

	return newObject;
}

const __resolvedMain = process.argv[1] !== undefined ? path.resolve(process.argv[1]) : "";

if (__resolvedMain === fileURLToPath(import.meta.url)) {
	const checkOnly = process.argv.includes("--check");
	const ok = SortSeeds({ checkOnly });
	if (checkOnly && !ok) {
		console.error(
			"db/seeds JSON is not in canonical sorted order or key ordering. Run: bun run --filter tachi-seeds-scripts sort",
		);
		process.exitCode = 1;
	}
}

export default SortSeeds;
