import { spawn } from "node:child_process";
import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import path from "path";
import { defineConfig } from "vite";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";

config();

/**
 * Vite's `server.open` / `preview.open` resolve against `resolvedUrls`, which use
 * `localhost` for loopback when `host: true` (see vite `resolveServerUrls`). The IDE
 * may also open forwarded ports as `localhost`. Opening the OS browser ourselves
 * with an explicit loopback URL keeps the address bar on localhost when that matters.
 */
function openLoopbackInBrowserPlugin(): Plugin {
	const schedule = (
		httpServer: ViteDevServer["httpServer"],
		portFallback: number | undefined,
		useHttps: boolean,
	) => {
		if (!httpServer) return;
		// Opt out for headless dev containers / CI where no browser opener exists.
		if (process.env.TACHI_NO_OPEN === "1" || process.env.CI) return;
		const run = () => {
			const addr = httpServer.address();
			const port =
				typeof addr === "object" && addr && "port" in addr
					? addr.port
					: (portFallback ?? 3000);
			const protocol = useHttps ? "https" : "http";
			const url = `${protocol}://localhost:${port}/`;
			const [cmd, args]: [string, string[]] =
				process.platform === "darwin"
					? ["open", [url]]
					: process.platform === "win32"
						? ["cmd", ["/c", "start", "", url]]
						: ["xdg-open", [url]];
			const child = spawn(cmd, args, {
				detached: true,
				stdio: "ignore",
				shell: false,
			});
			// Without this, a missing opener binary (e.g. no xdg-open in a dev
			// container) emits an unhandled 'error' event and crashes vite.
			child.on("error", () => {});
			child.unref();
		};
		if (httpServer.listening) run();
		else httpServer.once("listening", run);
	};

	return {
		name: "open-loopback-explicit",
		apply: "serve",
		configureServer(server: ViteDevServer) {
			return () => {
				schedule(
					server.httpServer,
					server.config.server.port,
					Boolean(server.config.server.https),
				);
			};
		},
		configurePreviewServer(server: PreviewServer) {
			return () => {
				schedule(
					server.httpServer,
					server.config.preview.port,
					Boolean(server.config.preview.https),
				);
			};
		},
	};
}

export default defineConfig({
	build: {
		assetsDir: "static",

		outDir: process.env.BUILD_OUT_DIR || "build",
		sourcemap: true,
	},
	css: {
		preprocessorOptions: {
			scss: {
				additionalData:
					process.env.VITE_TCHIC_MODE === "boku"
						? "$primary: #527acc;"
						: "$primary: #e61c6e;",
				silenceDeprecations: ["import", "global-builtin", "color-functions", "if-function"],
			},
		},
	},
	plugins: [
		openLoopbackInBrowserPlugin(),
		react(),
		createHtmlPlugin({
			inject: {
				data: {
					TACHI_NAME: process.env.TACHI_NAME,
					THEME_INIT: `
<script>
const root = document.documentElement;
const theme = localStorage.theme ||
(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

root.style.setProperty("color-scheme", theme === "light" ? "light" : "dark"),
root.setAttribute("data-bs-theme", theme);
</script>
					`,
					VITE_CDN_URL: process.env.VITE_CDN_URL,
				},
			},
		}),
	],
	preview: {
		open: false,
		port: 3000,
	},
	resolve: {
		alias: [
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
	server: {
		host: true,
		open: false,
		port: 3000,
		// Same-origin `/api` + `/ir` so local dev can use HTTP + SameSite=Lax session cookies (no HTTPS).
		proxy: {
			"/api": { target: "http://localhost:8080", changeOrigin: true },
			"/ir": { target: "http://localhost:8080", changeOrigin: true },
		},
		watch: {
			usePolling: process.env.FORCE_FS_POLLING === "true",
		},
	},
});
