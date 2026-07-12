// Whether edit-mode code paths are compiled in at all.
//
// This is a *build-time* flag set in vite.config.ts. In a production build
// (`vite build`) it is the literal `false`, so the bundler tree-shakes every
// branch guarded by `EDIT_MODE`. That's how we keep the static prod bundle
// absolutely incapable of writing to disk - even if someone self-hosted it.
//
// `hasDevTransport` (see #lib/transport/transport) additionally probes
// /__seeds/ping at runtime before enabling the edit UI, in case a dev-built
// bundle is served from somewhere unexpected.
export const EDIT_MODE =
	(import.meta.env.VITE_SEEDS_EDIT_MODE as unknown as boolean | string) === true ||
	import.meta.env.VITE_SEEDS_EDIT_MODE === "true";

// Target repo for the GitHub transport (used in prod and as a fallback in dev).
// Format: "owner/repo". Configured via VITE_SEEDS_REPO in vite.config.ts.
export const SEEDS_REPO = (import.meta.env.VITE_SEEDS_REPO as string | undefined) ?? "zkldi/Tachi3";

// Web URL for links in the diff UI (compare, commits, optional ?pr= from the GitHub bot).
export const SEEDS_GITHUB_HTML_URL = `https://github.com/${SEEDS_REPO}`;

export const SEEDS_DEFAULT_BRANCH =
	(import.meta.env.VITE_SEEDS_BRANCH as string | undefined) ?? "main";

// Path of the seeds directory inside the repo. Matches DEFAULT_SEEDS_DIR in
// typescript/server/src/test-utils/seed-paths.ts.
export const SEEDS_REPO_PATH = "db/seeds";

// Key used for storing the user's optional GitHub PAT in localStorage.
// Only referenced by the GitHub transport; never sent anywhere except api.github.com.
export const GITHUB_PAT_KEY = "seeds-webui:github-pat";

// Well-known collection file names, mirrored from tachi-common's DatabaseSeedNames.
// We keep a separate list here so the webui can enumerate files *without*
// pulling in tachi-common's game-config graph at runtime.
// (We cross-check this against DatabaseSeedNames in a unit test later.)
export const KNOWN_COLLECTIONS = [
	"bms-course-lookup.json",
	"folders.json",
	"goals.json",
	"questlines.json",
	"quests.json",
	"tables.json",
] as const;
