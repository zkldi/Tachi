import type {
	Branch,
	CollectionName,
	Commit,
	CommitPage,
	GitStatus,
	JsonPatch,
	RunEvent,
	SeedsTransport,
} from "./index";

// Talks to the Vite dev plugin's /__seeds/* endpoints.
// Only instantiated when a runtime probe of /__seeds/ping succeeds.

const BASE = "/__seeds";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${input}`, {
		...init,
		headers: {
			"content-type": "application/json",
			...init?.headers,
		},
	});
	if (!res.ok) {
		throw new Error(`seeds-webui dev transport ${input}: HTTP ${res.status}`);
	}
	return (await res.json()) as T;
}

export async function probeDevTransport(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE}/ping`, { method: "GET" });
		return res.ok;
	} catch {
		return false;
	}
}

export function makeDevTransport(): SeedsTransport {
	return {
		mode: "dev",
		listCollections: () => jsonFetch<CollectionName[]>("/collections"),
		listBranches: () => jsonFetch<{ branches: Branch[]; current: Branch | null }>("/branches"),
		listCommits: (opts) => {
			const params = new URLSearchParams();
			if (opts.branch) {
				params.set("branch", opts.branch);
			}
			if (opts.file) {
				params.set("file", opts.file);
			}
			if (opts.cursor) {
				params.set("cursor", opts.cursor);
			}
			return jsonFetch<CommitPage>(`/commits?${params.toString()}`);
		},
		getCommit: (sha) => jsonFetch<Commit>(`/commit?sha=${encodeURIComponent(sha)}`),
		getCollection: (name, rev) => {
			const params = new URLSearchParams({ name });
			if (rev !== undefined) {
				params.set("rev", rev);
			}
			return jsonFetch<unknown[]>(`/collection?${params.toString()}`);
		},
		writeCollection: (name, patch) =>
			jsonFetch<void>("/collection", {
				body: JSON.stringify({ name, patch } satisfies {
					name: CollectionName;
					patch: JsonPatch;
				}),
				method: "POST",
			}),
		runSort: () => jsonFetch<void>("/sort", { method: "POST" }),
		gitStatus: () => jsonFetch<GitStatus>("/status"),
		runTests: () => streamSSE<RunEvent>("/tests/run", {}),
	};
}

// Server-Sent Events helper - the dev plugin streams stdout/stderr line-by-line
// plus a final `exit` event, so we wrap it as an AsyncIterable<RunEvent>.
async function* streamSSE<T>(pathname: string, body: unknown): AsyncIterable<T> {
	const res = await fetch(`${BASE}${pathname}`, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	if (!res.body) {
		throw new Error(`seeds-webui dev transport ${pathname}: no stream body`);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffer += decoder.decode(value, { stream: true });

			// SSE frames are separated by a blank line; events are `data: <json>\n`
			let delim: number;
			while ((delim = buffer.indexOf("\n\n")) !== -1) {
				const frame = buffer.slice(0, delim);
				buffer = buffer.slice(delim + 2);

				for (const line of frame.split("\n")) {
					if (line.startsWith("data:")) {
						const payload = line.slice(5).trim();
						if (payload.length === 0) {
							continue;
						}
						yield JSON.parse(payload) as T;
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
