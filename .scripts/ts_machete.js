#!/usr/bin/env bun

/**
 * ts_machete: Find (and optionally remove) unused dependencies across workspace packages.
 * Mirrors the behaviour of `cargo machete` for TypeScript/JS monorepos.
 *
 * Usage:
 *   bun .scripts/ts_machete.js          # report unused deps
 *   bun .scripts/ts_machete.js --fix    # also remove them from package.json
 *
 * Root package.json may define `tsMachete.excludeGlobal` (dep names) and
 * `tsMachete.exclude` (map of workspace package `name` → dep names) for
 * dependencies that are used via scripts, tooling, SCSS, ESLint config, etc.
 */

import path from "node:path";
import fs from "node:fs";
import { Glob } from "bun";

const args = process.argv.slice(2);
const fix = args.includes("--fix");

// ANSI colours
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const cwd = path.resolve(__dirname, "..");
process.chdir(cwd);

const rootPkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

const tsMacheteConfig = rootPkg.tsMachete ?? {};
const excludeGlobal = new Set(tsMacheteConfig.excludeGlobal ?? []);
const excludeByPackageName = tsMacheteConfig.exclude ?? {};

/**
 * @param {string | undefined} packageName workspace package.json `name`
 * @param {string} depName
 */
function isTsMacheteExcluded(packageName, depName) {
	if (excludeGlobal.has(depName)) {
		return true;
	}
	if (!packageName) {
		return false;
	}
	const per = excludeByPackageName[packageName];
	return Array.isArray(per) && per.includes(depName);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Node.js built-in module names (without the node: prefix). */
const NODE_BUILTINS = new Set([
	"assert",
	"buffer",
	"child_process",
	"cluster",
	"console",
	"constants",
	"crypto",
	"dgram",
	"dns",
	"domain",
	"events",
	"fs",
	"http",
	"http2",
	"https",
	"inspector",
	"module",
	"net",
	"os",
	"path",
	"perf_hooks",
	"process",
	"punycode",
	"querystring",
	"readline",
	"repl",
	"stream",
	"string_decoder",
	"sys",
	"timers",
	"tls",
	"trace_events",
	"tty",
	"url",
	"util",
	"v8",
	"vm",
	"worker_threads",
	"zlib",
]);

/**
 * Given an import specifier, return the npm package name it belongs to,
 * or null if it is a relative/local/built-in import that has no package.json entry.
 *
 * Returns the sentinel "__node_builtin__" for bare or node:-prefixed Node.js modules
 * so that @types/node detection still works.
 */
function extractPackageName(specifier) {
	// Relative imports and local path aliases (e.g. "#utils/log")
	if (specifier.startsWith(".") || specifier.startsWith("#")) {
		return null;
	}

	// node: protocol (e.g. "node:fs")
	if (specifier.startsWith("node:")) {
		return "__node_builtin__";
	}

	const bare = specifier.split("/")[0];

	// Bare Node.js built-ins imported without the node: prefix (legacy style)
	if (NODE_BUILTINS.has(bare)) {
		return "__node_builtin__";
	}

	// Scoped packages: "@scope/pkg" or "@scope/pkg/subpath" → "@scope/pkg"
	if (specifier.startsWith("@")) {
		const parts = specifier.split("/");
		if (parts.length >= 2) {
			return `${parts[0]}/${parts[1]}`;
		}
		return null;
	}

	// Regular packages: "lodash/fp" → "lodash"
	return bare;
}

/** Build-output directory prefixes to exclude when scanning source files. */
const EXCLUDED_PREFIXES = ["node_modules/", "js/", "dist/", "build/", ".cache/"];

/** Return all TS/JS source file paths inside a package directory. */
function getSourceFiles(pkgDir) {
	const glob = new Glob("**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}");
	const files = [];

	for (const rel of glob.scanSync(pkgDir)) {
		if (EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
			continue;
		}
		files.push(path.join(pkgDir, rel));
	}

	return files;
}

// Pre-compiled patterns for extracting import specifiers from source text.
// We match three syntactic forms:
//   1. Static imports/exports:  import ... from "pkg"   /  export ... from "pkg"
//   2. Dynamic imports:         import("pkg")
//   3. CommonJS require:        require("pkg")
const IMPORT_PATTERNS = [
	/\bfrom\s+["']([^"'\s]+)["']/gm,
	// Side-effect imports: import "pkg" / import 'pkg' (no `from` clause)
	/\bimport\s+["']([^"'\s]+)["']/gm,
	/\bimport\(["']([^"'\s]+)["']\)/gm,
	/\brequire\(["']([^"'\s]+)["']\)/gm,
];

/**
 * Scan all source files in pkgDir and return the set of npm package names
 * that are actually imported.
 */
function findUsedPackages(pkgDir) {
	const used = new Set();
	const files = getSourceFiles(pkgDir);

	for (const file of files) {
		let content;
		try {
			content = fs.readFileSync(file, "utf8");
		} catch {
			continue;
		}

		for (const pattern of IMPORT_PATTERNS) {
			pattern.lastIndex = 0;
			let match;
			while ((match = pattern.exec(content)) !== null) {
				const pkgName = extractPackageName(match[1]);
				if (pkgName !== null) {
					used.add(pkgName);
				}
			}
		}
	}

	return used;
}

/**
 * Determine whether a listed dependency is "used", given the set of packages
 * actually imported in the source tree.
 *
 * Special handling for @types/* packages: "@types/foo" is considered used when:
 *   - "foo" itself appears in imports (TypeScript automatically uses @types/foo), OR
 *   - depName is "@types/node" and any Node.js built-in is imported.
 */
function isDepUsed(depName, usedPackages) {
	if (depName.startsWith("@types/")) {
		const underlying = depName.slice("@types/".length);

		if (underlying === "node") {
			return usedPackages.has("__node_builtin__");
		}

		// "@types/react-router-dom" → underlying "react-router-dom"
		return usedPackages.has(underlying);
	}

	return usedPackages.has(depName);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let totalUnused = 0;
let totalFixed = 0;
let packageCount = 0;

for (const workspacePattern of rootPkg.workspaces) {
	const glob = new Glob(workspacePattern + "*/package.json");

	for (const pkgPath of glob.scanSync(".")) {
		// Exclude packages nested inside node_modules (the workspace glob pattern
		// produces "typescript/**\/package.json" which recurses into node_modules).
		if (pkgPath.includes("node_modules/")) {
			continue;
		}

		const pkgDir = path.dirname(pkgPath);
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

		const usedPackages = findUsedPackages(path.join(cwd, pkgDir));

		const unusedBySection = {};

		for (const section of ["dependencies", "devDependencies"]) {
			if (!pkg[section]) {
				continue;
			}

			for (const depName of Object.keys(pkg[section])) {
				if (isTsMacheteExcluded(pkg.name, depName)) {
					continue;
				}
				if (!isDepUsed(depName, usedPackages)) {
					(unusedBySection[section] ??= []).push(depName);
				}
			}
		}

		const unusedCount = Object.values(unusedBySection).reduce((n, arr) => n + arr.length, 0);

		if (unusedCount === 0) {
			continue;
		}

		packageCount++;
		console.log(`\n${BOLD}${pkgPath}${RESET}  ${DIM}(${pkg.name ?? pkgDir})${RESET}`);

		for (const [section, deps] of Object.entries(unusedBySection)) {
			console.log(`  ${DIM}${section}:${RESET}`);
			for (const dep of deps) {
				console.log(`    ${RED}✗${RESET} ${dep}`);
				totalUnused++;

				if (fix) {
					delete pkg[section][dep];
					totalFixed++;
				}
			}
		}

		if (fix && unusedCount > 0) {
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t"));
		}
	}
}

// Summary
console.log("");

if (totalUnused === 0) {
	console.log(`${GREEN}${BOLD}✓ No unused dependencies found.${RESET}`);
} else {
	const depWord = totalUnused === 1 ? "dependency" : "dependencies";

	if (fix) {
		console.log(
			`${GREEN}${BOLD}✓ Removed ${totalFixed} unused ${depWord} across ${packageCount} package(s).${RESET}`,
		);
	} else {
		console.log(
			`${YELLOW}${BOLD}⚠ Found ${totalUnused} unused ${depWord} across ${packageCount} package(s).${RESET}`,
		);
		console.log(`${DIM}  Run with --fix to remove them automatically.${RESET}`);
	}
}

process.exit(totalUnused > 0 && !fix ? 1 : 0);
