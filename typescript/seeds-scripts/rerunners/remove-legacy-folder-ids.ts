import { readFileSync, writeFileSync } from "node:fs";
import type { SEEDS_FolderDocument } from "tachi-common";

const seedsPath = new URL("../../../db/seeds/folders.json", import.meta.url);
const folders = JSON.parse(readFileSync(seedsPath, "utf8")) as Array<
	SEEDS_FolderDocument & { legacyFolderID?: string }
>;
let removed = 0;

for (const folder of folders) {
	if (Object.hasOwn(folder, "legacyFolderID")) {
		delete folder.legacyFolderID;
		removed++;
	}
}

if (removed > 0) {
	writeFileSync(seedsPath, JSON.stringify(folders, null, "\t"));
}

console.log(`Removed legacy folder IDs from ${removed} folders.`);
