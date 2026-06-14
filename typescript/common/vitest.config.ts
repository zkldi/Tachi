import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,

		env: {
			NODE_ENV: "test",
		},
		exclude: [
			...configDefaults.exclude,
			// Compiled output - not test sources.
			"build/**",
		],
		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text", "html", "clover", "json", "lcov"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "build/**"],
		},
	},
});
