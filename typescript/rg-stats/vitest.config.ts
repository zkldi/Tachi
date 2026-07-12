import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		passWithNoTests: true,

		env: {
			NODE_ENV: "test",
		},
		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text", "html", "clover", "json", "lcov"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/test-utils/**",
				// Barrel only re-exports algorithms - no executable lines to cover.
				"src/index.ts",
				// Type-only / unused by current test surface (Tap nyc also did not require these).
				"src/util/types.ts",
				"src/util/options.ts",
			],
			thresholds: {
				lines: 100,
				statements: 100,
				functions: 100,
				branches: 100,
			},
		},
	},
	resolve: {
		alias: {
			"rg-stats": path.resolve(__dirname, "src/index.ts"),
		},
	},
});
