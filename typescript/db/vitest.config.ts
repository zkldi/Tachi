import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,

		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text", "html", "clover", "json", "lcov"],
			// Hand-written surface only; generated Kysely types are huge and not meaningfully coverable.
			include: ["src/index.ts"],
		},
	},
});
