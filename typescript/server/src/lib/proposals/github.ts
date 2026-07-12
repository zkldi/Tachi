/**
 * GitHub App helpers for the quest-proposal PR workflow.
 *
 * All functions require GITHUB_APP_CONFIG to be present in ServerConfig.
 * Callers should check `ServerConfig.GITHUB_APP_CONFIG !== undefined` before
 * calling these, and return 503 to the client if the config is absent.
 */

import { log } from "#lib/log/log";
import { ServerConfig } from "#lib/setup/config";
import { App } from "@octokit/app";

// Lazily-initialised singleton so we only create the App once per process.
let _app: App | null = null;

function getApp(): App {
	if (_app !== null) {
		return _app;
	}

	const cfg = ServerConfig.GITHUB_APP_CONFIG;

	if (!cfg) {
		throw new Error("GITHUB_APP_CONFIG is not configured. Cannot use GitHub App.");
	}

	_app = new App({
		appId: cfg.APP_ID,
		privateKey: cfg.PRIVATE_KEY,
	});

	return _app;
}

/**
 * Returns an installation-scoped Octokit that can act on the configured repo.
 */
export async function getInstallationOctokit() {
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;
	const app = getApp();

	return app.getInstallationOctokit(cfg.INSTALLATION_ID);
}

type OctokitInstance = Awaited<ReturnType<typeof getInstallationOctokit>>;

/**
 * Reads a file from the default branch of the configured repo.
 * Returns the decoded string content and the blob SHA (needed for updates).
 */
export async function readRepoFile(
	octokit: OctokitInstance,
	path: string,
): Promise<{ content: string; sha: string }> {
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
		owner: cfg.REPO_OWNER,
		repo: cfg.REPO_NAME,
		path,
	});

	if (Array.isArray(data) || data.type !== "file") {
		throw new Error(`Expected a file at ${path} but got a directory or unexpected response.`);
	}

	// GitHub returns base64-encoded content
	const content = Buffer.from(data.content, "base64").toString("utf-8");

	return { content, sha: data.sha };
}

/**
 * Gets the SHA of the default branch's HEAD commit.
 */
async function getDefaultBranchSHA(octokit: OctokitInstance): Promise<string> {
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}", {
		owner: cfg.REPO_OWNER,
		repo: cfg.REPO_NAME,
	});

	const defaultBranch = repoData.default_branch;

	const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
		owner: cfg.REPO_OWNER,
		repo: cfg.REPO_NAME,
		ref: `heads/${defaultBranch}`,
	});

	return refData.object.sha;
}

type FileChange = {
	content: string;
	path: string;
};

/**
 * Creates or force-updates a branch, commits the given file changes, and
 * either opens a new PR or updates the body/title of an existing one.
 *
 * Returns the PR number.
 */
export async function openOrUpdateProposalPR(opts: {
	branch: string;
	changes: Array<FileChange>;
	existingPrNumber?: number;
	octokit: OctokitInstance;
	prBody: string;
	prTitle: string;
}): Promise<number> {
	const { octokit, branch, prTitle, prBody, changes, existingPrNumber } = opts;
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;
	const { REPO_OWNER: owner, REPO_NAME: repo } = cfg;

	// 1. Get the base SHA from the default branch
	const baseSHA = await getDefaultBranchSHA(octokit);

	// 2. Create a new git tree with the file changes
	const treeItems = await Promise.all(
		changes.map(async (change) => ({
			path: change.path,
			mode: "100644" as const,
			type: "blob" as const,
			content: change.content,
		})),
	);

	const { data: treeData } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
		owner,
		repo,
		base_tree: baseSHA,
		tree: treeItems,
	});

	// 3. Create a commit on top of the base
	const { data: commitData } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
		owner,
		repo,
		message: prTitle,
		tree: treeData.sha,
		parents: [baseSHA],
	});

	// 4. Create or force-update the branch ref
	const refPath = `refs/heads/${branch}`;
	try {
		await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
			owner,
			repo,
			ref: refPath,
			sha: commitData.sha,
		});
	} catch {
		// Branch already exists — force-update it
		await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
			owner,
			repo,
			ref: `heads/${branch}`,
			sha: commitData.sha,
			force: true,
		});
	}

	// 5. Open or update the PR
	if (existingPrNumber !== undefined) {
		await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
			owner,
			repo,
			pull_number: existingPrNumber,
			title: prTitle,
			body: prBody,
		});

		log.info({ prNumber: existingPrNumber, branch }, "Updated existing quest-proposal PR.");

		return existingPrNumber;
	}

	// Get default branch name for base
	const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}", {
		owner,
		repo,
	});

	const { data: prData } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
		owner,
		repo,
		title: prTitle,
		body: prBody,
		head: branch,
		base: repoData.default_branch,
	});

	log.info({ prNumber: prData.number, branch }, "Opened new quest-proposal PR.");

	return prData.number;
}

/**
 * Fetches the current state of a PR from GitHub.
 * Returns "open", "merged", or "closed".
 */
export async function getPRStatus(prNumber: number): Promise<"closed" | "merged" | "open"> {
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;
	const octokit = await getInstallationOctokit();

	const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
		owner: cfg.REPO_OWNER,
		repo: cfg.REPO_NAME,
		pull_number: prNumber,
	});

	if (data.merged_at !== null) {
		return "merged";
	}

	return data.state as "closed" | "open";
}
