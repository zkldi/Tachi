import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		// Map #* path aliases to src/* so vite-node resolves them correctly.
		// This mirrors the "imports" field in package.json and the "paths" in tsconfig.json.
		alias: [
			{
				find: /^#(.+)/u,
				replacement: `${path.resolve(__dirname, "src")}/$1`,
			},
		],
	},

	test: {
		passWithNoTests: true,

		// Static env vars. POSTGRES_URL is set dynamically per-worker in vitest.setup.ts
		// so each worker gets its own isolated database.
		env: {
			NODE_ENV: "test",
			PORT: "3001",
			TACHI_SERVER_LOCATION: "http://localhost:9001",
			HTTP_SERVER_URL: "http://localhost:3001",
			OAUTH_CLIENT_ID: "test-client-id",
			OAUTH_CLIENT_SECRET: "test-client-secret",
			DISCORD_TOKEN: "test-discord-token",
			DISCORD_SERVER_ID: "test-server-id",
		},

		// Parallel test execution - each worker gets its own isolated Postgres database.
		fileParallelism: true,
		globalSetup: "./vitest.globalSetup.ts",
		setupFiles: "./vitest.setup.ts",
		// forks pool gives stronger process isolation between workers.
		pool: "forks",

		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text", "html", "clover", "json", "lcov"],
			include: ["src/actions/**"],
		},
	},
});
