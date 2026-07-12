/**
 * IIDX-only convenience wrapper. Prefer `add-folder-slugs.ts --only iidx-sp,iidx-dp`.
 */
import { Command } from "commander";

import { MutateCollection, ReadCollection } from "../../util";
import { applyFolderSlugs } from "./apply-folder-slugs";
import { type SeedFolderRow } from "./folder-slug";

const IIDX_ONLY = new Set(["iidx-dp", "iidx-sp"]);

const program = new Command();

program
	.name("add-iidx-folder-slugs")
	.description("Set folder.slug for iidx-sp / iidx-dp rows in folders.json")
	.option("--write", "Persist changes to db/seeds/folders.json", false)
	.parse(process.argv);

const opts = program.opts() as { write: boolean };

if (opts.write) {
	MutateCollection("folders.json", (rows: Array<SeedFolderRow>) => {
		const out = applyFolderSlugs(rows, IIDX_ONLY);

		console.log(
			`[add-iidx-folder-slugs] wrote: updated ${out.updated}, already had slug ${out.skippedAlreadySet}`,
		);
		console.log(
			`[add-iidx-folder-slugs] updated by game: ${JSON.stringify(out.updatedByGame)}`,
		);

		return rows;
	});
} else {
	const folders = ReadCollection("folders.json") as Array<SeedFolderRow>;
	const clone = structuredClone(folders) as Array<SeedFolderRow>;
	const out = applyFolderSlugs(clone, IIDX_ONLY);

	const iidxCount = folders.filter((f) => IIDX_ONLY.has(f.game)).length;

	console.log(`[add-iidx-folder-slugs] dry-run (pass --write to save)`);
	console.log(`[add-iidx-folder-slugs] IIDX folder rows: ${iidxCount}`);
	console.log(
		`[add-iidx-folder-slugs] would set slug on ${out.updated} rows; ${out.skippedAlreadySet} already correct`,
	);
	console.log(
		`[add-iidx-folder-slugs] would update by game: ${JSON.stringify(out.updatedByGame)}`,
	);
}
