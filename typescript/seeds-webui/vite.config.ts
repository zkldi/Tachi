import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import { seedsDevPlugin } from "./dev/vite-plugin-seeds-dev";

// seeds-webui is a pure static SPA in production.
// In `vite dev` the seedsDevPlugin mounts /__seeds/* endpoints against the
// local repo's db/seeds/ so the UI can edit, query git history, and run
// the seeds-scripts tests. These endpoints are NOT present in the
// production build - all references to them are gated behind
// import.meta.env.VITE_SEEDS_EDIT_MODE and tree-shaken out.

const REPO_ROOT = path.resolve(__dirname, "../..");

// Some sort of hack for dealing with multiple @codemirror instances.
const cmPackage = (name: string) => path.join(REPO_ROOT, "node_modules", "@codemirror", name);

const codemirrorSingleInstanceAliases: {
	find: string;
	replacement: string;
}[] = ["autocomplete", "commands", "lang-sql", "language", "lint", "search", "state", "view"].map(
	(name) => ({ find: `@codemirror/${name}`, replacement: cmPackage(name) }),
);

const lezerPackage = (name: string) => path.join(REPO_ROOT, "node_modules", "@lezer", name);

// A similar hack to the cmPackage one above - AI stuffed
// both of these in the repo in response to an issue with
// the code editor not highlighting things correctly.
const lezerSingleInstanceAliases: {
	find: string;
	replacement: string;
}[] = ["common", "highlight", "lr"].map((name) => ({
	find: `@lezer/${name}`,
	replacement: lezerPackage(name),
}));

export default defineConfig(({ command }) => ({
	// Edit mode is only on for `vite dev` - `vite build` and `vite preview`
	// disable the editing-of-seeds stuff that is only useful for local dev.
	define: {
		"import.meta.env.VITE_SEEDS_EDIT_MODE": JSON.stringify(command === "serve"),
		"import.meta.env.VITE_SEEDS_REPO": JSON.stringify(
			process.env.VITE_SEEDS_REPO ?? "zkldi/Tachi",
		),
		"import.meta.env.VITE_SEEDS_BRANCH": JSON.stringify(
			process.env.VITE_SEEDS_BRANCH ?? "main",
		),
	},
	build: {
		outDir: process.env.BUILD_OUT_DIR || "build",
		sourcemap: true,
		target: "es2022",
	},
	worker: {
		format: "es",
	},
	optimizeDeps: {
		// sqlite-wasm ships pre-compiled wasm + a worker-friendly loader. Stop Vite from
		// trying to pre-bundle it, which breaks its own inline worker.
		exclude: ["@sqlite.org/sqlite-wasm"],
	},
	plugins: [
		react(),
		...(command === "serve"
			? [seedsDevPlugin({ repoRoot: REPO_ROOT })]
			: [
					// In prod builds, short-circuit modules that are only reachable
					// when EDIT_MODE is on. `editRoutes` hosts the edit-only pages
					// and `schemas` pulls in the whole tachi-common game config tree
					// for zod introspection - we don't want either of those shipping
					// to seeds.tachi.ac.
					{
						name: "seeds-webui:strip-edit-routes",
						enforce: "pre" as const,
						resolveId(source: string) {
							if (
								source.endsWith("/app/editRoutes") ||
								source.endsWith("/app/editRoutes.ts")
							) {
								return "\0virtual:empty-edit-routes";
							}
							if (
								source.endsWith("#lib/edits/schemas") ||
								source.endsWith("/lib/edits/schemas") ||
								source.endsWith("/lib/edits/schemas.ts")
							) {
								return "\0virtual:empty-schemas";
							}
							return null;
						},
						load(id: string) {
							if (id === "\0virtual:empty-edit-routes") {
								return "export const editRoutes = [];";
							}
							if (id === "\0virtual:empty-schemas") {
								return "export function schemaForCollection() { return null; }";
							}
							return null;
						},
					},
				]),
	],
	resolve: {
		dedupe: [
			"@codemirror/autocomplete",
			"@codemirror/commands",
			"@codemirror/language",
			"@codemirror/lint",
			"@codemirror/search",
			"@codemirror/state",
			"@codemirror/view",
			"@lezer/common",
			"@lezer/highlight",
			"@lezer/lr",
		],
		alias: [
			...lezerSingleInstanceAliases,
			...codemirrorSingleInstanceAliases,
			{
				find: /^tachi-common(.*)$/u,
				replacement: path.resolve(__dirname, "../common/src", "$1"),
			},
			{
				find: /^#(.*)$/u,
				replacement: path.resolve(__dirname, "src/$1"),
			},
		],
	},
	css: {
		preprocessorOptions: {
			scss: {
				silenceDeprecations: ["color-functions", "global-builtin", "if-function", "import"],
			},
		},
	},
	server: {
		host: true,
		open: false,
		port: 3003,
	},
	preview: {
		open: false,
		port: 3003,
	},
}));
