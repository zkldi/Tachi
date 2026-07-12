import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ReadCollection, WriteCollection } from "../util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLECTIONS_DIR = path.join(__dirname, "../../../db/seeds");

const NOW = Date.now();

function ShortID() {
	return crypto.randomBytes(8).toString("hex");
}

const games = fs
	.readdirSync(COLLECTIONS_DIR)
	.filter((f) => f.startsWith("songs-"))
	.map((f) => f.replace(/^songs-/, "").replace(/\.json$/, ""));

// ── Pass 1: songs ─────────────────────────────────────────────────────────────
// Build per-game maps keyed by old integer id:
//   songIdMap       → new hex id
//   songLegacyIdMap → legacySongID (for use when setting chart _added)
const songIdMap = new Map(); // "game:integerID" → new hex id
const songLegacyIdMap = new Map(); // "game:newHexId" → legacySongID

for (const game of games) {
	const collection = `songs-${game}.json`;
	const data = ReadCollection(collection);
	let modified = 0;

	for (const entry of data) {
		if (!entry.sid) {
			entry.sid = ShortID();
		}

		if (entry.sid) {
			// Preserve the old integer id before overwriting.
			if (entry.id !== undefined && typeof entry.id === "number") {
				entry.legacySongID = entry.id;
				songIdMap.set(`${game}:${entry.id}`, entry.sid);
				songLegacyIdMap.set(`${game}:${entry.sid}`, entry.id);
			}

			entry.id = entry.sid;
			delete entry.sid;
			modified++;
		}

		if (!entry._added) {
			entry._added = entry.legacySongID !== undefined ? NOW + entry.legacySongID : NOW;
		}
	}

	if (modified > 0) {
		WriteCollection(collection, data);
		console.log(`${collection}: migrated ${modified} entries`);
	} else {
		console.log(`${collection}: already migrated, skipped`);
	}
}

// ── Pass 2: charts ────────────────────────────────────────────────────────────

for (const game of games) {
	const collection = `charts-${game}.json`;
	const data = ReadCollection(collection);
	let modified = 0;

	for (const entry of data) {
		if (!entry.sid) {
			entry.sid = ShortID();
		}

		if (entry.sid) {
			// Keep old MongoDB chartID around for reference.
			if (entry.chartID) {
				entry.legacyChartID = entry.chartID;
				delete entry.chartID;
			}

			// Rewrite songID to the new hex song id.
			const newSongId = songIdMap.get(`${game}:${entry.songID}`);
			if (newSongId !== undefined) {
				entry.songID = newSongId;
			}

			entry.id = entry.sid;
			delete entry.sid;
			modified++;
		}

		if (!entry._added) {
			const legacySongID = songLegacyIdMap.get(`${game}:${entry.songID}`);
			entry._added = legacySongID !== undefined ? NOW + legacySongID : NOW;
		}
	}

	if (modified > 0) {
		WriteCollection(collection, data);
		console.log(`${collection}: migrated ${modified} entries`);
	} else {
		console.log(`${collection}: already migrated, skipped`);
	}
}
