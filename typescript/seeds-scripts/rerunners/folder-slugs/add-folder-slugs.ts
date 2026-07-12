/**
 * Assigns `slug` on folder seed rows in `db/seeds/folders.json`.
 * Rules live in `./folder-slug.ts` (`computeFolderSlug`).
 *
 * Default is dry-run. Pass `--write` to persist.
 *
 * @example
 * bun rerunners/folder-slugs/add-folder-slugs.ts
 * bun rerunners/folder-slugs/add-folder-slugs.ts --write
 * bun rerunners/folder-slugs/add-folder-slugs.ts --only iidx-sp,iidx-dp
 */
import { Command } from "commander";

import { MutateCollection, ReadCollection } from "../../util";
import { applyFolderSlugs } from "./apply-folder-slugs";
import { type SeedFolderRow } from "./folder-slug";

const program = new Command();

program
	.name("add-folder-slugs")
	.description("Set folder.slug for all games in folders.json")
	.option("--write", "Persist changes to db/seeds/folders.json", false)
	.option(
		"--only <games>",
		"Comma-separated `game` values (e.g. iidx-sp,chunithm). Default: all games.",
	)
	.parse(process.argv);

const opts = program.opts() as { only?: string; write: boolean };

const onlyGames =
	opts.only === undefined || opts.only === ""
		? null
		: new Set(
				opts.only
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0),
			);

if (opts.write) {
	MutateCollection("folders.json", (rows: Array<SeedFolderRow>) => {
		const out = applyFolderSlugs(rows, onlyGames);

		console.log(
			`[add-folder-slugs] wrote: updated ${out.updated}, already had slug ${out.skippedAlreadySet}`,
		);
		console.log(`[add-folder-slugs] updated by game: ${JSON.stringify(out.updatedByGame)}`);

		return rows;
	});
} else {
	const folders = ReadCollection("folders.json") as Array<SeedFolderRow>;
	const clone = structuredClone(folders) as Array<SeedFolderRow>;
	const out = applyFolderSlugs(clone, onlyGames);

	const n =
		onlyGames === null ? folders.length : folders.filter((f) => onlyGames.has(f.game)).length;

	console.log(`[add-folder-slugs] dry-run (pass --write to save)`);
	if (onlyGames !== null) {
		console.log(`[add-folder-slugs] --only ${[...onlyGames].join(",")}`);
	}

	console.log(`[add-folder-slugs] folder rows in scope: ${n}`);
	console.log(
		`[add-folder-slugs] would set slug on ${out.updated} rows; ${out.skippedAlreadySet} already correct`,
	);
	console.log(`[add-folder-slugs] would update by game: ${JSON.stringify(out.updatedByGame)}`);
}
