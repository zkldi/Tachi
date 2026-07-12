import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pExecFile = promisify(execFile);

export interface DevBranch {
	name: string;
	sha: string;
}

export interface DevCommit {
	sha: string;
	message: string;
	author: { date: string; email: string; name: string };
	committer: { date: string; email: string; name: string };
	parents: Array<{ sha: string }>;
}

export async function gitExec(
	repoRoot: string,
	args: string[],
): Promise<{ stderr: string; stdout: string }> {
	return pExecFile("git", args, {
		cwd: repoRoot,
		env: { ...process.env, GIT_PAGER: "cat", PAGER: "cat" },
		maxBuffer: 256 * 1024 * 1024,
	});
}

export async function listBranches(
	repoRoot: string,
): Promise<{ branches: DevBranch[]; current: DevBranch | null }> {
	const { stdout } = await gitExec(repoRoot, [
		"for-each-ref",
		"--format=%(refname:short)\t%(objectname:short)",
		"refs/heads",
	]);
	const branches: DevBranch[] = [];
	for (const line of stdout.split("\n")) {
		const [name, sha] = line.split("\t");
		if (name && sha) {
			branches.push({ name, sha });
		}
	}

	let current: DevBranch | null = null;
	try {
		const { stdout: head } = await gitExec(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
		const name = head.trim();
		if (name && name !== "HEAD") {
			const found = branches.find((b) => b.name === name);
			if (found) {
				current = found;
			}
		}
	} catch {
		// detached head - leave current null.
	}

	return { branches, current };
}

// git log format: each commit is 7 records terminated by NUL, separated
// from the next commit by a literal "\x1e" (record separator).
const LOG_FORMAT = ["%H", "%P", "%an", "%ae", "%aI", "%cn", "%ce", "%cI", "%s"].join("%x00");

export async function listCommits(
	repoRoot: string,
	opts: { branch?: string; file?: string; limit?: number; skip?: number },
): Promise<DevCommit[]> {
	const args = [
		"log",
		`--format=${LOG_FORMAT}%x1e`,
		`--max-count=${opts.limit ?? 30}`,
		`--skip=${opts.skip ?? 0}`,
	];
	if (opts.branch) {
		args.push(opts.branch);
	}
	if (opts.file) {
		args.push("--", opts.file);
	}

	const { stdout } = await gitExec(repoRoot, args);
	const commits: DevCommit[] = [];
	for (const record of stdout.split("\x1e")) {
		const parts = record.trim().split("\x00");
		if (parts.length < 9) {
			continue;
		}
		const [sha, parents, an, ae, ad, cn, ce, cd, message] = parts;
		commits.push({
			sha: sha!,
			parents: (parents ?? "")
				.split(" ")
				.filter(Boolean)
				.map((p) => ({ sha: p })),
			author: { name: an!, email: ae!, date: ad! },
			committer: { name: cn!, email: ce!, date: cd! },
			message: message!,
		});
	}
	return commits;
}

export async function getCommit(repoRoot: string, sha: string): Promise<DevCommit> {
	const [c] = await listCommits(repoRoot, { branch: sha, limit: 1 });
	if (!c) {
		throw new Error(`No commit found for ${sha}`);
	}
	return c;
}

export async function showFileAt(repoRoot: string, rev: string, path: string): Promise<string> {
	const { stdout } = await gitExec(repoRoot, ["show", `${rev}:${path}`]);
	return stdout;
}

export async function statusPorcelain(
	repoRoot: string,
): Promise<{ branch: string | null; changed: string[]; hasUncommitted: boolean }> {
	const { stdout } = await gitExec(repoRoot, ["status", "--porcelain=v1", "--branch"]);
	const lines = stdout.split("\n").filter(Boolean);
	let branch: string | null = null;
	const changed: string[] = [];
	for (const line of lines) {
		if (line.startsWith("##")) {
			const m = /^## ([^.\s]+)(?:\.\.\.|$| )/u.exec(line);
			branch = m?.[1] ?? null;
			continue;
		}
		// Porcelain format: " XY path" - strip the two-char status + space.
		changed.push(line.slice(3));
	}
	return { branch, changed, hasUncommitted: changed.length > 0 };
}
