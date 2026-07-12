// Pre-build step: copy db/seeds/*.json into public/seeds-bundle/ so the prod
// SPA can render the "current state" without touching the GitHub API.
//
// Produces:
//   public/seeds-bundle/<name>.json          (1:1 copy of each collection)
//   public/seeds-bundle/manifest.json        { sha, files: [{name, bytes, hash}] }
//
// Run with `bun scripts/bundle-current-seeds.ts`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(REPO_ROOT, "db", "seeds");
const OUT = path.join(__dirname, "..", "public", "seeds-bundle");

async function main() {
	await fs.mkdir(OUT, { recursive: true });

	const files = (await fs.readdir(SRC)).filter((n) => n.endsWith(".json")).sort();

	const manifest: {
		files: Array<{ bytes: number; hash: string; name: string }>;
		sha: string | null;
	} = {
		sha: detectSha(),
		files: [],
	};

	for (const name of files) {
		const srcPath = path.join(SRC, name);
		const buf = await fs.readFile(srcPath);
		const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
		await fs.writeFile(path.join(OUT, name), buf);
		manifest.files.push({ bytes: buf.byteLength, hash, name });
	}

	await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

	const totalBytes = manifest.files.reduce((s, f) => s + f.bytes, 0);
	console.log(
		`[seeds-webui] bundled ${files.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) -> ${path.relative(REPO_ROOT, OUT)}`,
	);
}

function detectSha(): string | null {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT })
			.toString("utf-8")
			.trim();
	} catch {
		return null;
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
