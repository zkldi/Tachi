import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Loads `typescript/server/.env` or `.env.test` (does not override existing `process.env`). */
export function loadServerEnvFile(filename: ".env" | ".env.test"): void {
	loadDotenv({ path: path.join(serverDir, filename), override: false });
}
