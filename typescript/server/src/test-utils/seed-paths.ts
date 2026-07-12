import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default `db/seeds` (collections JSON) relative to the server package - same as `load-seeds-pg.ts`. */
export const DEFAULT_SEEDS_DIR = path.resolve(__dirname, "../../../../db/seeds");

export function resolveSeedsDir(): string {
	return process.env.SEEDS_DIR ?? DEFAULT_SEEDS_DIR;
}

/** True when the repo’s seed JSON is present (e.g. `songs-iidx.json`). */
export function seedsJsonAvailable(): boolean {
	const dir = resolveSeedsDir();

	return fs.existsSync(path.join(dir, "songs-iidx.json"));
}
