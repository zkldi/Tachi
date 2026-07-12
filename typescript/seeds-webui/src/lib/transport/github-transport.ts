import { GITHUB_PAT_KEY, SEEDS_DEFAULT_BRANCH, SEEDS_REPO, SEEDS_REPO_PATH } from "#lib/config";

import type { Commit, SeedsTransport } from "./index";

// Read-only transport backed by the GitHub REST API and the bundled
// snapshot in /seeds-bundle/*.
//
// For "current state" queries we prefer the bundled snapshot (zero API
// calls, always fast). For historical queries we hit api.github.com.
// Users can paste a PAT into settings -> stored in localStorage -> used
// as `Authorization: Bearer <pat>` to lift the anonymous 60/hr quota
// to the 5000/hr authenticated one.

const GH = "https://api.github.com";

function ghHeaders(): HeadersInit {
	const pat = typeof localStorage !== "undefined" ? localStorage.getItem(GITHUB_PAT_KEY) : null;
	const headers: Record<string, string> = {
		accept: "application/vnd.github+json",
		"x-github-api-version": "2022-11-28",
	};
	if (pat) {
		headers.authorization = `Bearer ${pat}`;
	}
	return headers;
}

async function gh<T>(pathname: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${GH}${pathname}`, {
		...init,
		headers: { ...ghHeaders(), ...init?.headers },
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`GitHub ${pathname}: HTTP ${res.status} ${text}`);
	}
	return (await res.json()) as T;
}

interface GhCommit {
	sha: string;
	html_url: string;
	commit: {
		author: { date: string; email: string; name: string };
		committer: { date: string; email: string; name: string };
		message: string;
	};
	parents: Array<{ sha: string }>;
}

function mapCommit(c: GhCommit): Commit {
	return {
		sha: c.sha,
		message: c.commit.message,
		author: {
			name: c.commit.author.name,
			email: c.commit.author.email,
			date: c.commit.author.date,
		},
		committer: {
			name: c.commit.committer.name,
			email: c.commit.committer.email,
			date: c.commit.committer.date,
		},
		parents: c.parents.map((p) => ({ sha: p.sha })),
		htmlUrl: c.html_url,
	};
}

// Parse Link header for cursor-style pagination.
function parseLinkCursor(link: string | null): string | undefined {
	if (!link) {
		return undefined;
	}
	// Example: <https://api.github.com/...&page=2>; rel="next"
	const m = /<([^>]+)>; rel="next"/u.exec(link);
	if (!m) {
		return undefined;
	}
	const url = new URL(m[1]!);
	return url.searchParams.get("page") ?? undefined;
}

interface BundleManifest {
	sha?: string;
	files: Array<{ bytes: number; hash: string; name: string }>;
}

async function loadBundleManifest(): Promise<BundleManifest | null> {
	try {
		const res = await fetch("/seeds-bundle/manifest.json");
		if (!res.ok) {
			return null;
		}
		return (await res.json()) as BundleManifest;
	} catch {
		return null;
	}
}

export function makeGithubTransport(): SeedsTransport {
	return {
		mode: "github",

		listCollections: async () => {
			const m = await loadBundleManifest();
			if (m) {
				return m.files.map((f) => f.name);
			}

			// Fallback: list contents of db/seeds on the default branch.
			interface Entry {
				name: string;
				type: "dir" | "file";
			}
			const items = await gh<Entry[]>(
				`/repos/${SEEDS_REPO}/contents/${SEEDS_REPO_PATH}?ref=${SEEDS_DEFAULT_BRANCH}`,
			);
			return items
				.filter((e) => e.type === "file" && e.name.endsWith(".json"))
				.map((e) => e.name);
		},

		listBranches: async () => {
			interface GhBranch {
				name: string;
				commit: { sha: string };
			}
			const list = await gh<GhBranch[]>(`/repos/${SEEDS_REPO}/branches?per_page=100`);
			const branches = list.map((b) => ({ name: b.name, sha: b.commit.sha }));
			const current = branches.find((b) => b.name === SEEDS_DEFAULT_BRANCH) ?? null;
			return { branches, current };
		},

		listCommits: async (opts) => {
			const params = new URLSearchParams();
			params.set("sha", opts.branch ?? SEEDS_DEFAULT_BRANCH);
			params.set("path", opts.file ? `${SEEDS_REPO_PATH}/${opts.file}` : SEEDS_REPO_PATH);
			params.set("per_page", "30");
			if (opts.cursor) {
				params.set("page", opts.cursor);
			}

			const res = await fetch(`${GH}/repos/${SEEDS_REPO}/commits?${params.toString()}`, {
				headers: ghHeaders(),
			});
			if (!res.ok) {
				throw new Error(`GitHub /commits: HTTP ${res.status}`);
			}
			const nextCursor = parseLinkCursor(res.headers.get("link"));
			const commits = ((await res.json()) as GhCommit[]).map(mapCommit);
			return { commits, nextCursor };
		},

		getCommit: async (sha) => {
			const c = await gh<GhCommit>(`/repos/${SEEDS_REPO}/commits/${sha}`);
			return mapCommit(c);
		},

		getCollection: async (name, rev) => {
			// Prefer the bundled snapshot for "current state" (no rev given).
			if (rev === undefined) {
				const res = await fetch(`/seeds-bundle/${encodeURIComponent(name)}`);
				if (res.ok) {
					return (await res.json()) as unknown[];
				}
			}

			// Otherwise, fetch from raw.githubusercontent.com at the given ref.
			// We go through raw.githubusercontent because /contents returns base64 of
			// up to 1MB and charts-bms-7k etc. blow past that. This endpoint does
			// not count against the API rate limit either.
			const ref = rev ?? SEEDS_DEFAULT_BRANCH;
			const url = `https://raw.githubusercontent.com/${SEEDS_REPO}/${encodeURIComponent(
				ref,
			)}/${SEEDS_REPO_PATH}/${encodeURIComponent(name)}`;
			const res = await fetch(url);
			if (!res.ok) {
				throw new Error(`raw.githubusercontent ${name}@${ref}: HTTP ${res.status}`);
			}
			return (await res.json()) as unknown[];
		},
	};
}
