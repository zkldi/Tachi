import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,

		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text", "html", "clover", "json", "lcov"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
		},
	},
});
