import { log } from "#log";
import nodeFetch from "node-fetch";
import {
	BMS_TABLES,
	type BMSGames,
	type BMSTableInfo,
	type BmstableFetch,
	computeFolderSlug,
	type SEEDS_FolderDocument,
	type SEEDS_TableDocument,
	ParseAndLoadBMSTable,
} from "tachi-common";

import { Random20Hex } from "../../../server/src/utils/misc";
import { CreateFolderID, MutateCollection, ReadCollection } from "../../util";

const fetchBMSTable: BmstableFetch = async (url) => {
	const res = await nodeFetch(url);
	return {
		ok: res.ok,
		status: res.status,
		url: res.url,
		headers: { get: (name) => res.headers.get(name) },
		text: () => res.text(),
	};
};

function bmsPlaytype(game: BMSGames): "7K" | "14K" {
	return game === "bms-7k" ? "7K" : "14K";
}

function legacyTableID(tableInfo: BMSTableInfo): string {
	return `bms-${bmsPlaytype(tableInfo.game)}-${tableInfo.asciiPrefix}`;
}

function escapeSqlStringLiteral(value: string): string {
	return value.replaceAll("'", "''");
}

function levelWhere(prefix: string, level: string | number): string {
	const escapedPrefix = escapeSqlStringLiteral(prefix);
	const escapedLevel = escapeSqlStringLiteral(String(level));
	return `(chart.data->'tableFolders'->>'${escapedPrefix}') = '${escapedLevel}'`;
}

function presentWhere(prefix: string): string {
	const escapedPrefix = escapeSqlStringLiteral(prefix);
	return `(chart.data->'tableFolders') ? '${escapedPrefix}'`;
}

function levelSearchTerm(tableInfo: BMSTableInfo, level: string | number): string {
	return `${tableInfo.name} ${level}`;
}

function isExcludedSubLevel(level: string | number, slug: string): boolean {
	const levelText = String(level);
	return levelText.includes("sub") || slug.includes("sub");
}

type FolderSyncFields = Pick<SEEDS_FolderDocument, "searchTerms" | "title" | "where">;

function levelFolderFields(tableInfo: BMSTableInfo, level: string | number): FolderSyncFields {
	return {
		searchTerms: [levelSearchTerm(tableInfo, level)],
		title: `${tableInfo.prefix}${level}`,
		where: levelWhere(tableInfo.prefix, level),
	};
}

function presentFolderFields(tableInfo: BMSTableInfo): FolderSyncFields {
	return {
		searchTerms: [tableInfo.asciiPrefix],
		title: tableInfo.name,
		where: presentWhere(tableInfo.prefix),
	};
}

function buildLevelFolder(tableInfo: BMSTableInfo, level: string | number): SEEDS_FolderDocument {
	const fields = levelFolderFields(tableInfo, level);
	const folder: SEEDS_FolderDocument = {
		game: tableInfo.game,
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: Random20Hex(),
		slug: "",
		...fields,
	};
	folder.slug = computeFolderSlug(folder);
	return folder;
}

function buildPresentFolder(tableInfo: BMSTableInfo): SEEDS_FolderDocument {
	const fields = presentFolderFields(tableInfo);
	const folder: SEEDS_FolderDocument = {
		game: tableInfo.game,
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: Random20Hex(),
		slug: "",
		...fields,
	};
	folder.slug = computeFolderSlug(folder);
	return folder;
}

function applyFolderSyncFields(existing: SEEDS_FolderDocument, fields: FolderSyncFields): boolean {
	const unchanged =
		existing.title === fields.title &&
		existing.where === fields.where &&
		existing.searchTerms.length === fields.searchTerms.length &&
		existing.searchTerms.every((term, i) => term === fields.searchTerms[i]);

	if (unchanged) {
		return false;
	}

	existing.title = fields.title;
	existing.where = fields.where;
	existing.searchTerms = fields.searchTerms;
	return true;
}

function folderKey(game: string, slug: string): string {
	return `${game}:${slug}`;
}

function isBmsGame(game: BMSTableInfo["game"]): game is BMSGames {
	return game === "bms-7k" || game === "bms-14k";
}

async function syncBmsTableFolders(): Promise<void> {
	const folders = ReadCollection("folders.json") as Array<SEEDS_FolderDocument>;
	const tables = ReadCollection("tables.json") as Array<SEEDS_TableDocument>;

	const folderByKey = new Map(folders.map((f) => [folderKey(f.game, f.slug), f]));
	const tableByLegacyId = new Map(tables.map((t) => [t.legacyTableID, t]));

	for (const tableInfo of BMS_TABLES) {
		if (!isBmsGame(tableInfo.game)) {
			continue;
		}

		try {
			log.info(`Fetching ${tableInfo.url} (${tableInfo.name})...`);
			const { loadUrl, table } = await ParseAndLoadBMSTable(tableInfo, fetchBMSTable);
			if (loadUrl !== tableInfo.url) {
				log.info(`Resolved ${tableInfo.name} URL: ${tableInfo.url} -> ${loadUrl}`);
			}

			const existingTable = tableByLegacyId.get(legacyTableID(tableInfo));
			const isNewTable = existingTable === undefined;
			const curatedFolderSlugs = new Set(existingTable?.folders ?? []);

			for (const level of table.getLevelOrder()) {
				const fields = levelFolderFields(tableInfo, level);
				const slug = computeFolderSlug({
					game: tableInfo.game,
					id: "",
					slug: "",
					...fields,
				});
				if (isExcludedSubLevel(level, slug)) {
					continue;
				}

				const key = folderKey(tableInfo.game, slug);
				const existing = folderByKey.get(key);
				const inCuratedTable = isNewTable || curatedFolderSlugs.has(slug);

				if (existing && inCuratedTable) {
					if (applyFolderSyncFields(existing, fields)) {
						log.info(`Updated folder ${existing.slug} (${existing.title}).`);
					}
					continue;
				}

				if (!existing && inCuratedTable) {
					const candidate = buildLevelFolder(tableInfo, level);
					folders.push(candidate);
					folderByKey.set(key, candidate);
					log.info(`Inserted folder ${candidate.slug} (${candidate.title}).`);
				}
			}

			const presentFields = presentFolderFields(tableInfo);
			const presentSlug = computeFolderSlug({
				game: tableInfo.game,
				id: "",
				slug: "",
				...presentFields,
			});
			const presentKey = folderKey(tableInfo.game, presentSlug);
			const existingPresent = folderByKey.get(presentKey);
			const inCuratedPresent = isNewTable || curatedFolderSlugs.has(presentSlug);

			if (existingPresent && inCuratedPresent) {
				if (applyFolderSyncFields(existingPresent, presentFields)) {
					log.info(
						`Updated meta folder ${existingPresent.slug} (${existingPresent.title}).`,
					);
				}
			} else if (!existingPresent && inCuratedPresent) {
				const presentCandidate = buildPresentFolder(tableInfo);
				folders.push(presentCandidate);
				folderByKey.set(presentKey, presentCandidate);
				log.info(
					`Inserted meta folder ${presentCandidate.slug} (${presentCandidate.title}).`,
				);
			}
		} catch (err) {
			log.error(`Failed to sync ${tableInfo.name} (${tableInfo.url}): ${String(err)}`);
		}
	}

	MutateCollection("folders.json", () => folders);
	log.info("Done.");
}

void syncBmsTableFolders();
