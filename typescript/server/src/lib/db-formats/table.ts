import DB from "#services/pg/db";
import { type Selection } from "kysely";
import { type TableDocument, type V3Game } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_TABLE = [
	"table.id",
	"table.game",
	"table.inactive",
	"table.title",
	"table.default_value",
	"table.slug",
] as const;

export type TableRow = Selection<Database, "table", (typeof SELECT_TABLE)[number]>;

export function ToTableDocument(row: TableRow, folderSlugs: Array<string>): TableDocument {
	return {
		tableID: row.id,
		slug: row.slug,
		game: row.game,
		title: row.title,
		description: "",
		folders: folderSlugs,
		inactive: row.inactive,
		default: row.default_value,
	};
}

async function tableRowToDocumentWithFolders(row: TableRow): Promise<TableDocument> {
	const tfRows = await DB.selectFrom("table_folder")
		.innerJoin("folder", "folder.id", "table_folder.folder_id")
		.select(["folder.slug", "table_folder.ordering"])
		.where("table_folder.table_id", "=", row.id)
		.orderBy("table_folder.ordering", "asc")
		.execute();

	return ToTableDocument(
		row,
		tfRows.map((t) => t.slug),
	);
}

/**
 * Load table documents for a game/playtype (API shape). `folders` are folder **slugs** in order.
 */
export async function GetTableDocumentsForGame(
	game: V3Game,
	includeInactive: boolean,
): Promise<Array<TableDocument>> {
	let q = DB.selectFrom("table").select(SELECT_TABLE).where("game", "=", game);

	if (!includeInactive) {
		q = q.where("inactive", "=", false);
	}

	const rows = await q.execute();

	if (rows.length === 0) {
		return [];
	}

	const tableIds = rows.map((r) => r.id);

	const tfRows = await DB.selectFrom("table_folder")
		.innerJoin("folder", "folder.id", "table_folder.folder_id")
		.select(["table_folder.table_id", "folder.slug", "table_folder.ordering"])
		.where("table_folder.table_id", "in", tableIds)
		.orderBy("table_folder.table_id", "asc")
		.orderBy("table_folder.ordering", "asc")
		.execute();

	const foldersByTable = new Map<string, Array<string>>();

	for (const t of tfRows) {
		const list = foldersByTable.get(t.table_id) ?? [];

		list.push(t.slug);
		foldersByTable.set(t.table_id, list);
	}

	return rows.map((row) => ToTableDocument(row, foldersByTable.get(row.id) ?? []));
}

/** Load a table by its primary ID, including its ordered folder slugs. */
export async function LoadTableDocumentById(tableID: string): Promise<TableDocument | undefined> {
	const row = await DB.selectFrom("table")
		.select(SELECT_TABLE)
		.where("id", "=", tableID)
		.limit(1)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	return tableRowToDocumentWithFolders(row);
}

/** Load a table within a game by slug or primary ID, preferring slug on collisions. */
export async function LoadTableDocumentByGameAndSlug(
	game: V3Game,
	slugOrTableID: string,
): Promise<TableDocument | undefined> {
	const bySlug = await DB.selectFrom("table")
		.select(SELECT_TABLE)
		.where("game", "=", game)
		.where("slug", "=", slugOrTableID)
		.limit(1)
		.executeTakeFirst();

	if (bySlug) {
		return tableRowToDocumentWithFolders(bySlug);
	}

	const row = await DB.selectFrom("table")
		.select(SELECT_TABLE)
		.where("game", "=", game)
		.where("id", "=", slugOrTableID)
		.limit(1)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	return tableRowToDocumentWithFolders(row);
}
