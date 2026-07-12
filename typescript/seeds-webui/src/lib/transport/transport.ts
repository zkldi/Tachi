import { EDIT_MODE } from "#lib/config";

import type { SeedsTransport } from "./index";

import { makeDevTransport, probeDevTransport } from "./dev-transport";
import { makeGithubTransport } from "./github-transport";

// Resolves exactly once per page load.
let cached: Promise<SeedsTransport> | null = null;

/**
 * The single entry point used by components/pages.
 *
 * - In a prod build (`EDIT_MODE === false`), this short-circuits to the GitHub
 *   transport: the dev-transport probe code path is literally tree-shaken out.
 * - In a dev build, we probe `/__seeds/ping`. If it responds, edit UI is
 *   unlocked; otherwise we fall back to the GitHub transport (e.g. `vite
 *   preview` locally).
 */
export function getTransport(): Promise<SeedsTransport> {
	if (cached) {
		return cached;
	}

	cached = (async () => {
		if (EDIT_MODE && (await probeDevTransport())) {
			return makeDevTransport();
		}
		return makeGithubTransport();
	})();

	return cached;
}

export function resetTransport(): void {
	cached = null;
}

export type {
	Branch,
	CollectionName,
	Commit,
	CommitPage,
	GitStatus,
	JsonPatch,
	JsonPatchOp,
	RunEvent,
	SeedsTransport,
} from "./index";
