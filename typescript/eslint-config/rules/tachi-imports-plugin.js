/** @import { Rule } from "eslint" */

import fs from "node:fs";
import path from "node:path";

import { requireUnicodeRegexpFix } from "./require-unicode-regexp-fix.js";

const MESSAGE_NO_REDUNDANT_JS = "noRedundantJsExtension";
const MESSAGE_PREFER_HASH = "preferHashImport";

/** @type {Map<string, boolean>} */
const packageHashSrcCache = new Map();

/**
 * Strips a trailing `.js` from the path portion (before `?`), if present.
 * @param {string} specifier
 * @returns {string | null} The rewritten specifier, or null if unchanged.
 */
function stripRedundantJs(specifier) {
	const q = specifier.indexOf("?");
	const pathPart = q === -1 ? specifier : specifier.slice(0, q);
	if (!pathPart.endsWith(".js")) {
		return null;
	}
	const base = pathPart.slice(0, -3);
	return q === -1 ? base : base + specifier.slice(q);
}

/**
 * @param {string} specifier
 */
function shouldLintSpecifier(specifier) {
	return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("#");
}

/**
 * @param {import("eslint").Rule.RuleContext} context
 * @param {import("estree").Literal | null | undefined} sourceNode
 */
function checkRedundantJs(context, sourceNode) {
	if (!sourceNode || sourceNode.type !== "Literal") {
		return;
	}
	const raw = sourceNode.value;
	if (typeof raw !== "string" || !shouldLintSpecifier(raw)) {
		return;
	}
	const fixed = stripRedundantJs(raw);
	if (fixed === null) {
		return;
	}
	context.report({
		node: sourceNode,
		messageId: MESSAGE_NO_REDUNDANT_JS,
		fix(fixer) {
			const quote = sourceNode.raw[0];
			return fixer.replaceText(sourceNode, `${quote}${fixed}${quote}`);
		},
	});
}

/**
 * @param {string} startDir
 * @returns {string | null}
 */
function findPackageRoot(startDir) {
	let dir = startDir;
	while (true) {
		const pkg = path.join(dir, "package.json");
		if (fs.existsSync(pkg)) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return null;
		}
		dir = parent;
	}
}

/**
 * @param {string} packageRoot
 */
function packageHasHashSrcMapping(packageRoot) {
	const cached = packageHashSrcCache.get(packageRoot);
	if (cached !== undefined) {
		return cached;
	}
	const tsconfigPath = path.join(packageRoot, "tsconfig.json");
	if (!fs.existsSync(tsconfigPath)) {
		packageHashSrcCache.set(packageRoot, false);
		return false;
	}
	let data;
	try {
		data = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
	} catch {
		packageHashSrcCache.set(packageRoot, false);
		return false;
	}
	const star = data?.compilerOptions?.paths?.["#*"];
	const ok = Array.isArray(star) && star.length === 1 && star[0] === "./src/*";
	packageHashSrcCache.set(packageRoot, ok);
	return ok;
}

/**
 * @param {string} specifier
 */
function countLeadingDotDotSegments(specifier) {
	const q = specifier.indexOf("?");
	const pathPart = q === -1 ? specifier : specifier.slice(0, q);
	const normalized = path.posix.normalize(pathPart.replace(/\\/g, "/"));
	const parts = normalized.split("/").filter((p) => p.length > 0);
	let i = 0;
	while (i < parts.length && parts[i] === "..") {
		i++;
	}
	return i;
}

/**
 * @param {string} fromDir
 * @param {string} specifier
 * @returns {string | null}
 */
function resolveImportToFile(fromDir, specifier) {
	const q = specifier.indexOf("?");
	const pathPart = q === -1 ? specifier : specifier.slice(0, q);
	let resolved = path.resolve(fromDir, pathPart);

	if (fs.existsSync(resolved)) {
		const st = fs.statSync(resolved);
		if (st.isFile()) {
			return resolved;
		}
		if (st.isDirectory()) {
			const indexExts = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
			for (const ext of indexExts) {
				const indexFile = path.join(resolved, `index${ext}`);
				if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
					return indexFile;
				}
			}
		}
	}

	const baseExts = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
	for (const e of baseExts) {
		const p = resolved + e;
		if (fs.existsSync(p) && fs.statSync(p).isFile()) {
			return p;
		}
	}

	return null;
}

/**
 * @param {string} packageRoot
 * @param {string} absoluteFile
 * @returns {string | null}
 */
function absoluteFileToHashSpecifier(packageRoot, absoluteFile) {
	const srcRoot = path.join(packageRoot, "src");
	const relToSrc = path.relative(srcRoot, absoluteFile);
	if (relToSrc.startsWith("..") || path.isAbsolute(relToSrc)) {
		return null;
	}
	let posix = relToSrc.split(path.sep).join("/");
	posix = posix.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
	return `#${posix}`;
}

/**
 * @param {import("eslint").Rule.RuleContext} context
 * @param {import("estree").Literal | null | undefined} sourceNode
 */
function checkPreferHash(context, sourceNode) {
	if (!sourceNode || sourceNode.type !== "Literal") {
		return;
	}
	const raw = sourceNode.value;
	if (typeof raw !== "string" || raw.startsWith("#")) {
		return;
	}
	if (!raw.startsWith(".")) {
		return;
	}
	if (countLeadingDotDotSegments(raw) < 2) {
		return;
	}

	const currentFile = context.getFilename();
	if (currentFile === "<text>" || !path.isAbsolute(currentFile)) {
		return;
	}

	const packageRoot = findPackageRoot(path.dirname(currentFile));
	if (!packageRoot || !packageHasHashSrcMapping(packageRoot)) {
		return;
	}

	const fromDir = path.dirname(currentFile);
	const resolved = resolveImportToFile(fromDir, raw);
	if (!resolved) {
		return;
	}

	const newSpec = absoluteFileToHashSpecifier(packageRoot, resolved);
	if (!newSpec) {
		return;
	}

	const q = raw.indexOf("?");
	const suffix = q === -1 ? "" : raw.slice(q);
	const fixed = newSpec + suffix;

	context.report({
		node: sourceNode,
		messageId: MESSAGE_PREFER_HASH,
		fix(fixer) {
			const quote = sourceNode.raw[0];
			return fixer.replaceText(sourceNode, `${quote}${fixed}${quote}`);
		},
	});
}

/** @type {Rule.RuleModule} */
export const noRedundantJsExtension = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow redundant `.js` extensions in relative and `#` path import specifiers.",
		},
		fixable: "code",
		schema: [],
		messages: {
			[MESSAGE_NO_REDUNDANT_JS]:
				"Remove the redundant .js extension from this import path - just import it without an extension",
		},
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				checkRedundantJs(context, node.source);
			},
			ExportNamedDeclaration(node) {
				if (node.source) {
					checkRedundantJs(context, node.source);
				}
			},
			ExportAllDeclaration(node) {
				checkRedundantJs(context, node.source);
			},
			ImportExpression(node) {
				checkRedundantJs(context, node.source);
			},
		};
	},
};

/** @type {Rule.RuleModule} */
export const preferHashImport = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer `#src/...` path aliases over deep relative imports (at least two `../` segments).",
		},
		fixable: "code",
		schema: [],
		messages: {
			[MESSAGE_PREFER_HASH]:
				"Use a `#...` import path instead of a deep relative path (../../...)",
		},
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				checkPreferHash(context, node.source);
			},
			ExportNamedDeclaration(node) {
				if (node.source) {
					checkPreferHash(context, node.source);
				}
			},
			ExportAllDeclaration(node) {
				checkPreferHash(context, node.source);
			},
			ImportExpression(node) {
				checkPreferHash(context, node.source);
			},
		};
	},
};

export default {
	meta: { name: "eslint-plugin-tachi-imports", version: "1.0.0" },
	rules: {
		"no-redundant-js-extension": noRedundantJsExtension,
		"prefer-hash-import": preferHashImport,
		"require-unicode-regexp": requireUnicodeRegexpFix,
	},
};
