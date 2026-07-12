import fjsh from "fast-json-stable-hash";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
	CreateChartID,
	CreateFolderID,
	CreateQuestID,
	CreateSongID,
	CreateTableID,
} from "tachi-common";

import DeterministicCollectionSort from "./sort-seeds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Seed JSON lives at repo root: db/seeds/ (was typescript/collections).
const COLLECTIONS_DIR = path.join(__dirname, "../../db/seeds");

/**
 * @param {(data: unknown, collection: string) => unknown} cb
 */
export function IterateCollections(cb) {
	for (const collection of fs
		.readdirSync(COLLECTIONS_DIR)
		.filter((name) => name.endsWith(".json"))) {
		const data = cb(
			JSON.parse(fs.readFileSync(path.join(COLLECTIONS_DIR, collection))),
			collection,
		);

		fs.writeFileSync(path.join(COLLECTIONS_DIR, collection), JSON.stringify(data, null, "\t"));
	}

	DeterministicCollectionSort();
}

export function ReadCollection(name, throwIfNotFound = false) {
	const p = path.join(COLLECTIONS_DIR, name);
	if (!fs.existsSync(p)) {
		if (throwIfNotFound) {
			throw new Error(`No collection ${name} exists.`);
		}

		fs.writeFileSync(p, JSON.stringify([]));
		return [];
	}

	return JSON.parse(fs.readFileSync(p));
}

/**
 * @param {string} name
 * @param {unknown} data
 */
export function WriteCollection(name, data) {
	fs.writeFileSync(path.join(COLLECTIONS_DIR, name), JSON.stringify(data, null, "\t"));

	DeterministicCollectionSort();
}

/**
 * @param {string} name
 * @param {(collection: unknown) => unknown} cb
 */
export function MutateCollection(name, cb) {
	const data = cb(ReadCollection(name));

	if (data === undefined) {
		throw new Error(`You forgot to return from your MutateCollection function.`);
	}

	WriteCollection(name, data);
}

// this api sucks, maybe dont use it
//
// TODO(zk): remove this and give folders actual readable names
export function CreateLegacyFolderID(query, game, playtype) {
	return `F${fjsh.hash(Object.assign({ game, playtype }, query), "SHA256")}`;
}

export function CreateLegacyFolderIDFromFolder(folder) {
	return CreateLegacyFolderID(folder.data, folder.game, folder.playtype);
}

export function CreateGoalID(charts, criteria, game) {
	return `G${fjsh.hash({ charts, criteria, game }, "sha256")}`;
}

// quick inplace deepmerge hack
// probably doesn't work for arrays, i don't care though.
export function EfficientInPlaceDeepmerge(ref, apply) {
	for (const key in apply) {
		if (typeof apply[key] === "object" && apply[key]) {
			EfficientInPlaceDeepmerge(ref[key], apply[key]);
		} else {
			ref[key] = apply[key];
		}
	}
}

export function GetChartCollectionGame(filename) {
	let result = filename.match(/charts-([\w-]+)\.json$/u);

	if (result === null) {
		throw new Error(`Could not extract game from ${filename}.`);
	}

	return result[1];
}

function GetSongCollectionGameGroup(filename) {
	let result = filename.match(/songs-([\w-]+)\.json$/u);

	if (result === null) {
		throw new Error(`Could not extract gameGroup from ${filename}.`);
	}

	return result[1];
}

export function GetFreshSongIDGenerator(gameGroup) {
	const existing = ReadCollection(`songs-${gameGroup}.json`);
	let max = existing.reduce((acc, s) => Math.max(acc, s.legacySongID ?? 0), 0);
	return () => ++max;
}

export {
	CreateChartID,
	CreateFolderID,
	CreateQuestID,
	CreateSongID,
	CreateTableID,
	GetSongCollectionGameGroup as GetSongCollectionGame,
};
