#!/usr/bin/env bun

/**
 * ts_autoinherit: Move pinned dependency versions from workspace package.json files
 * into the root catalog so every package uses `catalog:` references.
 *
 * Usage:
 *   bun .scripts/ts_autoinherit.js          # apply changes in place
 *   bun .scripts/ts_autoinherit.js --check  # report violations, exit 1 if any
 */

import path from "node:path";
import fs from "node:fs";
import { Glob } from "bun";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const check = args.includes("--check");

// ANSI colours
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const cwd = path.resolve(__dirname, "..");
process.chdir(cwd);

const rootPkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

/** @type {Array<{pkgPath: string, key: string, dependency: string, version: string}>} */
const violations = [];

for (const workspacePattern of rootPkg.workspaces) {
	// "typescript/*" + "/package.json" => "typescript/*/package.json" (one workspace dir only).
	// "typescript/*" + "*/package.json" would merge *+* into ** and match nested paths / node_modules.
	let glob = new Glob(workspacePattern + "/package.json");

	for (const pkgPath of glob.scanSync(".")) {
		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, pkgPath), "utf8"));

		for (const key of ["devDependencies", "dependencies"]) {
			for (const [dependency, version] of Object.entries(pkg[key] ?? {})) {
				if (version.startsWith("workspace:")) {
					continue;
				}

				if (version.startsWith("catalog:")) {
					continue;
				}

				violations.push({ pkgPath, key, dependency, version });

				if (!check) {
					pkg[key][dependency] = "catalog:";
					rootPkg.catalog[dependency] = version;
				}
			}
		}

		if (!check) {
			console.log(pkgPath);
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t"));
		}
	}
}

if (check) {
	if (violations.length === 0) {
		console.log(`${GREEN}${BOLD}✓ All dependencies use catalog: references.${RESET}`);
	} else {
		const byFile = /** @type {Map<string, typeof violations>} */ (new Map());
		for (const v of violations) {
			const list = byFile.get(v.pkgPath) ?? [];
			list.push(v);
			byFile.set(v.pkgPath, list);
		}
		for (const [pkgPath, vs] of byFile) {
			console.log(`\n${BOLD}${pkgPath}${RESET}`);
			for (const { key, dependency, version } of vs) {
				console.log(`  ${RED}✗${RESET} ${DIM}${key}:${RESET} ${dependency}@${version}`);
			}
		}
		console.log(
			`\n${YELLOW}${BOLD}⚠ ${violations.length} dep(s) not using catalog: references.${RESET}`,
		);
		console.log(`${DIM}  Run \`.scripts/ts_autoinherit.js\` to fix automatically.${RESET}`);
		process.exit(1);
	}
} else {
	fs.writeFileSync("package.json", JSON.stringify(rootPkg, null, "\t"));
	execSync("just fmt", { stdio: "inherit" });
}
