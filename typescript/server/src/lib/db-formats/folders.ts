import DB from "#services/pg/db";
import { type Selection } from "kysely";
import { type FolderDocument, type V3Game } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_FOLDER = [
	"folder.id",
	"folder.legacy_id",
	"folder.game",
	"folder.inactive",
	"folder.title",
	"folder.slug",
	"folder.where",
	"folder.search_terms",
] as const;

export function ToFolderDocument(
	row: Selection<Database, "folder", (typeof SELECT_FOLDER)[number]>,
): FolderDocument {
	return {
		folderID: row.id,
		slug: row.slug,
		game: row.game,
		inactive: row.inactive,
		searchTerms: row.search_terms ?? [],
		title: row.title,
	};
}

export async function LoadFolderDocumentById(
	folderID: string,
): Promise<FolderDocument | undefined> {
	const row = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("id", "=", folderID)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	return ToFolderDocument(row);
}

export async function LoadFolderDocumentsByIds(
	folderIds: Array<string>,
): Promise<Map<string, FolderDocument>> {
	if (folderIds.length === 0) {
		return new Map();
	}

	const rows = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("id", "in", folderIds)
		.execute();

	const out = new Map<string, FolderDocument>();

	for (const row of rows) {
		out.set(row.id, ToFolderDocument(row));
	}

	return out;
}

/**
 * Loads a folder for this GPT. The key may be **`slug`**, primary **`folder.id`**, or
 * **`legacy_id`** (in that order of precedence when keys could theoretically collide).
 */
export async function LoadFolderDocumentByGameAndSlug(
	game: V3Game,
	slugOrFolderKey: string,
): Promise<FolderDocument | undefined> {
	const bySlug = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("folder.game", "=", game)
		.where("folder.slug", "=", slugOrFolderKey)
		.executeTakeFirst();

	if (bySlug) {
		return ToFolderDocument(bySlug);
	}

	const byId = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("folder.game", "=", game)
		.where("folder.id", "=", slugOrFolderKey)
		.executeTakeFirst();

	if (byId) {
		return ToFolderDocument(byId);
	}

	const byLegacy = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("folder.game", "=", game)
		.where("folder.legacy_id", "=", slugOrFolderKey)
		.executeTakeFirst();

	if (byLegacy) {
		return ToFolderDocument(byLegacy);
	}

	return undefined;
}

/**
 * Loads folders by slug for one game; map keys are **slug** (not id).
 */
export async function LoadFolderDocumentsByGameAndSlugs(
	game: V3Game,
	slugs: Array<string>,
): Promise<Map<string, FolderDocument>> {
	if (slugs.length === 0) {
		return new Map();
	}

	const rows = await DB.selectFrom("folder")
		.select(SELECT_FOLDER)
		.where("game", "=", game)
		.where("slug", "in", slugs)
		.execute();

	const out = new Map<string, FolderDocument>();

	for (const row of rows) {
		out.set(row.slug, ToFolderDocument(row));
	}

	return out;
}
