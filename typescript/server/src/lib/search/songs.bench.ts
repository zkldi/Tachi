import type { GameGroup } from "tachi-common";

import DB from "#services/pg/db";
import { importSeeds } from "#services/pg/seeds";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, bench, describe } from "vitest";

import { LoadSongChildrenForPgIds, SearchSongsForGameFtsAndTrgm } from "./songs";

/** Default: repo `db/seeds` (override with `SEEDS_DIR` for custom trees). */
const SEEDS_DIR =
	process.env.SEEDS_DIR ??
	path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../../db/seeds");

const GAME_IIDX = "iidx" as const satisfies GameGroup;
const GAME_BMS = "bms" as const satisfies GameGroup;

async function searchWithSongChildren(game: GameGroup, query: string, limit: number) {
	const rows = await SearchSongsForGameFtsAndTrgm(game, query, limit);

	if (rows.length === 0) {
		return;
	}

	await LoadSongChildrenForPgIds(rows.map((r) => r.id));
}

describe("Postgres song search (full seeds)", () => {
	beforeAll(async () => {
		await importSeeds(DB, SEEDS_DIR);
	}, 600_000);

	bench("iidx FTS - gradius (title)", async () => {
		await SearchSongsForGameFtsAndTrgm(GAME_IIDX, "gradius", 50);
	});

	bench("iidx FTS - taka (artist)", async () => {
		await SearchSongsForGameFtsAndTrgm(GAME_IIDX, "taka", 50);
	});

	bench("iidx short query - ab (FTS + trgm)", async () => {
		await SearchSongsForGameFtsAndTrgm(GAME_IIDX, "ab", 50);
	});

	bench("iidx sparse - xyzunlikely (mostly trgm / empty FTS)", async () => {
		await SearchSongsForGameFtsAndTrgm(GAME_IIDX, "xyzunlikely", 50);
	});

	bench("bms FTS - fezike (artist)", async () => {
		await SearchSongsForGameFtsAndTrgm(GAME_BMS, "fezike", 50);
	});

	bench("iidx search + song search_terms / alt_titles columns", async () => {
		await searchWithSongChildren(GAME_IIDX, "gradius", 50);
	});
});
