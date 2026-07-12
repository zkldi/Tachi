export type Row = Record<string, unknown>;

// Candidate primary keys, in priority order. The first one present on a row is
// used. `id` is listed before `songID` because chart documents carry both -
// we want to key a chart by *its* id, not by the song it belongs to.
export const PK_KEYS = [
	"id",
	"folderID",
	"tableID",
	"questID",
	"questlineID",
	"goalID",
	"songID",
	"md5sums",
] as const;

export function primaryKey(row: Row): string | null {
	for (const k of PK_KEYS) {
		const v = row[k];
		if (typeof v === "string" || typeof v === "number") {
			return `${k}=${v}`;
		}
	}
	return null;
}

export function rowLabel(row: Row): string {
	return primaryKey(row) ?? "(row)";
}
