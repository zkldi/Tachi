// Transport abstraction: a single interface that lets the UI talk to seeds,
// regardless of whether we're running locally (with a dev server that can
// write to disk) or in prod (read-only, backed by the GitHub API).
//
// Edit methods (`writeCollection`, `runTests`, …) are *optional* on the
// interface. In prod they are `undefined`; every UI site that uses them must
// null-check, which is how read-only mode is enforced at the type level.

export type CollectionName = string;

export interface Branch {
	name: string;
	sha: string;
}

export interface Commit {
	sha: string;
	message: string;
	author: {
		date: string;
		email?: string;
		name: string;
	};
	committer?: {
		date: string;
		email?: string;
		name: string;
	};
	parents: Array<{ sha: string }>;
	// URL to view this commit (GitHub or local placeholder).
	htmlUrl?: string;
}

export interface CommitPage {
	commits: Commit[];
	nextCursor?: string;
}

export interface GitStatus {
	branch: string | null;
	hasUncommittedChanges: boolean;
	changedFiles: string[];
}

export type RunEvent =
	| { code: number; kind: "exit" }
	| { data: string; kind: "stderr" }
	| { data: string; kind: "stdout" };

// JSON Patch op (RFC 6902 subset we support: add/remove/replace).
export type JsonPatchOp =
	| { op: "add"; path: string; value: unknown }
	| { op: "remove"; path: string }
	| { op: "replace"; path: string; value: unknown };

export type JsonPatch = JsonPatchOp[];

export interface SeedsTransport {
	readonly mode: "dev" | "github";

	// Read-side - always available.
	listCollections(): Promise<CollectionName[]>;
	listBranches(): Promise<{ branches: Branch[]; current: Branch | null }>;
	listCommits(opts: { branch?: string; cursor?: string; file?: string }): Promise<CommitPage>;
	getCommit(sha: string): Promise<Commit>;
	// rev `undefined` means "current working directory" in dev and "default
	// branch HEAD" in github.
	getCollection(name: CollectionName, rev?: string): Promise<unknown[]>;

	// Write-side - populated only in dev mode.
	writeCollection?: (name: CollectionName, patch: JsonPatch) => Promise<void>;
	runSort?: () => Promise<void>;
	gitStatus?: () => Promise<GitStatus>;
	runTests?: () => AsyncIterable<RunEvent>;
}

export function isWritable(
	t: SeedsTransport,
): t is Required<Pick<SeedsTransport, "writeCollection">> & SeedsTransport {
	return typeof t.writeCollection === "function";
}
