import { readFileSync, writeFileSync } from "node:fs";
import {
	NormalizeTableSlug,
	SEEDS_TABLE_DOCUMENT_SCHEMA,
	type SEEDS_TableDocument,
} from "tachi-common";

const seedsPath = new URL("../../../db/seeds/tables.json", import.meta.url);
const source = readFileSync(seedsPath, "utf8");
const tables = JSON.parse(source) as Array<
	Omit<SEEDS_TableDocument, "slug"> & { legacyTableID?: string; slug?: string }
>;
const seen = new Set<string>();

for (const table of tables) {
	// Drop the old game/playtype prefix; the game now scopes each slug.
	if (!table.slug) {
		table.slug = NormalizeTableSlug(table.legacyTableID?.replace(/^[^-]+-[^-]+-/u, "") ?? "");
	}
	delete table.legacyTableID;
	SEEDS_TABLE_DOCUMENT_SCHEMA.parse(table);

	const key = `${table.game}/${table.slug}`;
	if (seen.has(key)) {
		throw new Error(`Duplicate table slug: ${key}`);
	}
	seen.add(key);
}

const output = JSON.stringify(
	tables.map((table) =>
		Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b))),
	),
	null,
	"\t",
);
if (output !== source) {
	writeFileSync(seedsPath, output);
}
console.log(`Validated slugs and removed legacy IDs for ${tables.length} tables.`);
