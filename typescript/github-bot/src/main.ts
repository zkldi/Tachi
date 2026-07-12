import type { Repository } from "@octokit/webhooks-types";

import { log } from "#utils/log";
import { App, createNodeMiddleware } from "@octokit/app";
import express from "express";
import { URLSearchParams } from "url";

import { ProcessEnv } from "./config";

const app = new App({
	appId: ProcessEnv.appId,
	privateKey: ProcessEnv.privateKey,
	webhooks: {
		secret: ProcessEnv.webhookSecret,
	},
	oauth: {
		clientId: ProcessEnv.clientID,
		clientSecret: ProcessEnv.clientSecret,
	},
});

const COMMENT_MARKERS = {
	questProposal: "<!-- tachi-ghbot:quest-proposal -->",
	seedDiff: "<!-- tachi-ghbot:seed-diff -->",
	githubDirWarning: "<!-- tachi-ghbot:github-dir-warning -->",
} as const;

type CommentMarker = (typeof COMMENT_MARKERS)[keyof typeof COMMENT_MARKERS];

type OctokitRequester = {
	request: (route: string, params: object) => Promise<{ data: unknown }>;
};

type IssueComment = {
	body: string;
	id: number;
};

function withCommentMarker(message: string, marker: CommentMarker): string {
	return `${message.trimEnd()}\n${marker}`;
}

/**
 * Create a response that contains a link to the seeds diff viewer on seeds.tachi.ac.
 */
function mkSeedDiffViewMsg(baseSha: string, headSha: string, prNumber: number) {
	const params = new URLSearchParams({
		base: baseSha,
		head: headSha,
		pr: String(prNumber),
	});

	const origin = ProcessEnv.seedsWebuiOrigin.replace(/\/$/u, "");
	return `\nThis pull request changes files under \`db/seeds/\`. [View the seed diff in the Seeds web UI](${origin}/diff?${params.toString()}).`;
}

/**
 * Create a rich comment for quest-proposal PRs, linking to the dedicated
 * quest-preview page on seeds.tachi.ac in addition to the regular diff link.
 */
function mkQuestProposalMsg(baseSha: string, headSha: string, prNumber: number) {
	const origin = ProcessEnv.seedsWebuiOrigin.replace(/\/$/u, "");

	const diffParams = new URLSearchParams({
		base: baseSha,
		head: headSha,
		file: "quests.json",
		pr: String(prNumber),
	});

	const previewUrl = `${origin}/pr/${prNumber}`;
	const diffUrl = `${origin}/diff?${diffParams.toString()}`;

	return `🎯 **Quest Proposal**

This PR was submitted via the Quest Editor.

| | |
|---|---|
| **Preview quests** | [View on Seeds viewer](${previewUrl}) |
| **Seed diff** | [quests.json diff](${diffUrl}) |

_A reviewer will check the content and merge when it looks good. You can update this PR from the Quest Editor at any time._`;
}

function prTouchesSeeds(files: Array<{ filename: string }>): boolean {
	return files.some((k) => k.filename.startsWith("db/seeds/") || k.filename === "db/seeds");
}

function prTouchesGithubDir(files: Array<{ filename: string }>): boolean {
	return files.some((k) => k.filename.startsWith(".github/") || k.filename === ".github");
}

/**
 * Returns the subset of changed files that live inside .github/.
 */
function githubDirFiles(files: Array<{ filename: string }>): Array<string> {
	return files.map((k) => k.filename).filter((f) => f.startsWith(".github/") || f === ".github");
}

/**
 * Extremely noisy warning comment for PRs that modify files under .github/.
 * Changes here can affect CI, permissions, and the entire repository security
 * surface, so reviewers must treat them with extreme caution.
 */
function mkGithubDirWarningMsg(touchedFiles: Array<string>): string {
	const fileList = touchedFiles.map((f) => `- \`${f}\``).join("\n");

	return `${`# ⛔ WARNING ⛔ — This PR modifies files in .github. Don't approve the CI runs until you've read it Mr ZK.\n`.repeat(3)}\n${fileList}`;
}

async function listAllPullFiles(
	octokit: {
		request: (route: string, params: object) => Promise<{ data: Array<{ filename: string }> }>;
	},
	owner: string,
	repoName: string,
	pullNumber: number,
): Promise<Array<{ filename: string }>> {
	const out: Array<{ filename: string }> = [];
	let page = 1;
	while (true) {
		// GitHub returns up to 100 files per page; fetch pages sequentially.
		// eslint-disable-next-line no-await-in-loop -- pagination must be sequential
		const { data } = await octokit.request(
			"GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
			{
				owner,
				repo: repoName,
				pull_number: pullNumber,
				per_page: 100,
				page,
			},
		);
		const batch = data;
		out.push(...batch);
		if (batch.length < 100) {
			break;
		}
		page += 1;
	}
	return out;
}

async function findBotComment(
	octokit: OctokitRequester,
	owner: string,
	repoName: string,
	issueNumber: number,
	marker: CommentMarker,
): Promise<IssueComment | undefined> {
	let page = 1;
	while (true) {
		// eslint-disable-next-line no-await-in-loop -- pagination must be sequential
		const { data } = await octokit.request(
			"GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
			{
				owner,
				repo: repoName,
				issue_number: issueNumber,
				per_page: 100,
				page,
			},
		);
		const batch = data as IssueComment[];
		const existing = batch.find((comment) => comment.body.includes(marker));
		if (existing) {
			return existing;
		}
		if (batch.length < 100) {
			break;
		}
		page += 1;
	}
	return undefined;
}

async function upsertBotComment(
	message: string,
	marker: CommentMarker,
	octokit: OctokitRequester,
	repo: Repository,
	issueNumber: number,
): Promise<"created" | "updated"> {
	const owner = repo.owner.login;
	const body = withCommentMarker(message, marker);
	const existing = await findBotComment(octokit, owner, repo.name, issueNumber, marker);

	if (existing) {
		await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
			owner,
			repo: repo.name,
			comment_id: existing.id,
			body,
		});
		return "updated";
	}

	await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
		owner,
		repo: repo.name,
		issue_number: issueNumber,
		body,
	});
	return "created";
}

async function sendMsg(
	message: string,
	octokit: OctokitRequester,
	repo: Repository,
	issue: number,
) {
	await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
		owner: repo.owner.login,
		repo: repo.name,
		issue_number: issue,
		body: message,
	});
}

app.webhooks.on(
	["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"],
	async ({ octokit, payload }) => {
		const repo = payload.repository as Repository;
		const pr = payload.pull_request;
		const isQuestProposal = pr.head.ref.startsWith("quest-proposal/");

		log.info(
			{
				action: payload.action,
				prNumber: pr.number,
				branch: pr.head.ref,
				isQuestProposal,
			},
			"Handling pull_request webhook.",
		);

		// Quest-proposal PRs get a dedicated preview comment; all other PRs that
		// touch db/seeds/ get the standard seed-diff link.
		if (isQuestProposal) {
			const commentAction = await upsertBotComment(
				mkQuestProposalMsg(pr.base.sha, pr.head.sha, pr.number),
				COMMENT_MARKERS.questProposal,
				octokit,
				repo,
				pr.number,
			);
			log.info({ prNumber: pr.number, commentAction }, "Upserted quest-proposal comment.");
			return;
		}

		try {
			const filesChanged = await listAllPullFiles(
				octokit,
				repo.owner.login,
				repo.name,
				pr.number,
			);

			if (prTouchesGithubDir(filesChanged)) {
				const commentAction = await upsertBotComment(
					mkGithubDirWarningMsg(githubDirFiles(filesChanged)),
					COMMENT_MARKERS.githubDirWarning,
					octokit,
					repo,
					pr.number,
				);
				log.info(
					{ prNumber: pr.number, commentAction },
					"Upserted .github dir warning comment.",
				);
			}

			if (prTouchesSeeds(filesChanged)) {
				const commentAction = await upsertBotComment(
					mkSeedDiffViewMsg(pr.base.sha, pr.head.sha, pr.number),
					COMMENT_MARKERS.seedDiff,
					octokit,
					repo,
					pr.number,
				);
				log.info({ prNumber: pr.number, commentAction }, "Upserted seed-diff comment.");
				return;
			}

			log.debug(
				{ prNumber: pr.number },
				"PR does not touch db/seeds or .github; no further comments posted.",
			);
		} catch (err) {
			log.error(
				{ err, prNumber: pr.number },
				"Failed to determine whether PR touches db/seeds.",
			);

			const commentAction = await upsertBotComment(
				`I failed horribly figuring out whether this was a seeds diff or not. I'm sorry!

*****
Reason

\`\`\`
${err}
\`\`\`

*****

${mkSeedDiffViewMsg(pr.base.sha, pr.head.sha, pr.number)}`,
				COMMENT_MARKERS.seedDiff,
				octokit,
				repo,
				pr.number,
			);
			log.info({ prNumber: pr.number, commentAction }, "Upserted seed-diff error comment.");
		}
	},
);

app.webhooks.on(["pull_request.closed"], async ({ payload }) => {
	const pr = payload.pull_request;

	log.info(
		{
			action: payload.action,
			prNumber: pr.number,
			branch: pr.head.ref,
			merged: pr.merged,
		},
		"Handling pull_request.closed webhook.",
	);

	// Only fire for merged PRs whose branch starts with quest-proposal/
	if (!pr.merged || !pr.head.ref.startsWith("quest-proposal/")) {
		log.debug(
			{ prNumber: pr.number, merged: pr.merged, branch: pr.head.ref },
			"Skipping quest-proposal merge notification.",
		);
		return;
	}

	if (!ProcessEnv.tachiApiOrigin || !ProcessEnv.tachiWebhookSecret) {
		log.warn(
			{ prNumber: pr.number },
			"Merged quest-proposal PR but TACHI_API_ORIGIN or TACHI_WEBHOOK_SECRET are not set; skipping server notification.",
		);
		return;
	}

	try {
		const res = await fetch(`${ProcessEnv.tachiApiOrigin}/proposals/webhook/merged`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-tachi-webhook-secret": ProcessEnv.tachiWebhookSecret,
			},
			body: JSON.stringify({ prNumber: pr.number }),
		});

		if (!res.ok) {
			log.error(
				{ prNumber: pr.number, status: res.status, statusText: res.statusText },
				"Failed to notify Tachi server of merged quest-proposal PR.",
			);
		} else {
			log.info({ prNumber: pr.number }, "Notified Tachi server: quest-proposal PR merged.");
		}
	} catch (err) {
		log.error(
			{ err, prNumber: pr.number },
			"Error notifying Tachi server of merged quest-proposal PR.",
		);
	}
});

app.webhooks.on(["issue_comment.created"], async ({ octokit, payload }) => {
	const body = payload.comment.body.trim();

	if (body.startsWith("+bot")) {
		const cmd = body
			.split("\n")[0]!
			.split(/\s+/u)[1]
			?.replace(/[^a-z]/u, "");

		log.info(
			{ prNumber: payload.issue.number, cmd: cmd ?? "(none)" },
			"Handling issue_comment +bot command.",
		);

		switch (cmd) {
			case "ping": {
				await sendMsg("pong!", octokit, payload.repository as any, payload.issue.number);
				break;
			}

			case "diff": {
				const pr = (
					await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
						owner: payload.repository.owner.login,
						repo: payload.repository.name,
						pull_number: payload.issue.number,
					})
				).data;

				await sendMsg(
					mkSeedDiffViewMsg(pr.base.sha, pr.head.sha, pr.number),
					octokit,
					payload.repository as any,
					pr.number,
				);
				break;
			}

			default:
				await sendMsg(
					`No idea what to do with command \`${cmd}\`, sorry!`,
					octokit,
					payload.repository as any,
					payload.issue.number,
				);
		}
	}
});

const serverMiddleware = createNodeMiddleware(app);

const expressApp = express();

expressApp.use(serverMiddleware);

expressApp.get("/.deploy/up", (_req, res) => res.sendStatus(200));

log.info({ port: ProcessEnv.port }, "Listening for GitHub webhooks.");
expressApp.listen(ProcessEnv.port);
