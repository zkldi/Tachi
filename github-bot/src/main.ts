/* eslint-disable no-console */
import { ProcessEnv } from "./config.js";
import { App, createNodeMiddleware } from "@octokit/app";
import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import type { Repository } from "@octokit/webhooks-types";

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

/**
 * Create a response that contains a link to the seeds diff viewer.
 */
function mkSeedDiffViewMsg(repo: string, sha: string, compareRepo: string, compareSHA: string) {
	const params = new URLSearchParams({
		repo: ConvertGitHubURL(repo),
		sha,
		compareRepo: ConvertGitHubURL(compareRepo),
		compareSHA,
	});

	return `\nA commit has changed the seeds. [View the diff here.](https://boku.tachi.ac/utils/seeds?${params.toString()})`;
}

function ConvertGitHubURL(url: string) {
	return url.replace("https://api.github.com/repos/", "GitHub:");
}

async function sendMsg(message: string, octokit: any, repo: Repository, issue: number) {
	await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
		owner: repo.owner.login,
		repo: repo.name,
		issue_number: issue,
		body: message,
	});
}

app.webhooks.on(["pull_request.opened", "pull_request.edited"], async ({ octokit, payload }) => {
	try {
		const filesChanged = (await fetch(
			`https://api.github.com/repos/zkldi/Tachi/pulls/${payload.number}/files`
		).then((r) => r.json())) as Array<{ filename: string }>;

		// if any file modified in this pr is a collection
		if (filesChanged.some((k) => k.filename.startsWith("seeds/collections"))) {
			// post a link to the diff viewer in the PR comments.
			await sendMsg(
				mkSeedDiffViewMsg(
					payload.pull_request.base.repo.url,
					payload.pull_request.base.sha,
					payload.pull_request.head.repo!.url,
					payload.pull_request.head.sha
				),
				octokit,
				payload.repository as any,
				payload.pull_request.number
			);
		}
	} catch (err) {
		await sendMsg(
			`I failed horribly figuring out whether this was a seeds diff or not. I'm sorry!

*****
Reason

\`\`\`
${err}
\`\`\`

*****

${mkSeedDiffViewMsg(
	payload.pull_request.base.repo.url,
	payload.pull_request.base.sha,
	payload.pull_request.head.repo!.url,
	payload.pull_request.head.sha
)}`,
			octokit,
			payload.repository as any,
			payload.pull_request.number
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
					mkSeedDiffViewMsg(
						pr.base.repo.url,
						pr.base.sha,
						pr.head.repo?.url ?? "unknown-url",
						pr.head.sha
					),
					octokit,
					payload.repository as any,
					pr.number
				);
				break;
			}

			default:
				await sendMsg(
					`No idea what to do with command \`${cmd}\`, sorry!`,
					octokit,
					payload.repository as any,
					payload.issue.number
				);
		}
	}
});

const serverMiddleware = createNodeMiddleware(app);

const expressApp = express();

expressApp.use(serverMiddleware);

console.log(`Listening on port ${ProcessEnv.port}.`);
expressApp.listen(ProcessEnv.port);
