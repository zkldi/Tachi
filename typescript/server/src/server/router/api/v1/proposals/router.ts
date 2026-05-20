/**
 * Quest Proposal API
 *
 * Allows authenticated users to submit quests from the editor as GitHub PRs.
 * The server converts the raw (inlined-goal) editor format to the seeds format,
 * opens/updates a PR via the GitHub App, and tracks the proposal in the DB.
 */

import type { GoalDocument } from "tachi-common";

import { log } from "#lib/log/log";
import {
	hydrateRawQuestlines,
	hydrateRawQuests,
	mergeIntoSeeds,
	type RawQuestDocument,
	type RawQuestlineDocument,
	type SeedsQuestDocument,
	type SeedsQuestlineDocument,
} from "#lib/proposals/convert";
import {
	getInstallationOctokit,
	getPRStatus,
	openOrUpdateProposalPR,
	readRepoFile,
} from "#lib/proposals/github";
import { success } from "#lib/router/typed-router";
import { ServerConfig } from "#lib/setup/config";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

// ─── Shared helpers ────────────────────────────────────────────────────────────

type OctokitLikeError = { response?: { data?: { message?: string } }; status?: number } & Error;

/**
 * Wraps a GitHub API call and converts Octokit RequestErrors into user-facing
 * ExpectedErrs with the GitHub error message included.
 */
async function callGitHub<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		const e = err as OctokitLikeError;

		if (e instanceof Error && typeof e.status === "number") {
			const ghMsg = e.response?.data?.message ?? e.message;

			throw new ExpectedErr(
				502,
				`GitHub API error (${e.status}): ${ghMsg}. Check that the GitHub App has Contents read/write and Pull requests read/write permissions on this repository.`,
			);
		}

		throw err;
	}
}

function requireGitHubConfig() {
	if (!ServerConfig.GITHUB_APP_CONFIG) {
		throw new ExpectedErr(503, "Quest proposals are not enabled on this instance.");
	}

	return ServerConfig.GITHUB_APP_CONFIG;
}

function requireSession(req: { session: { tachi?: { user?: { id: number; username: string } } } }) {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(401, "You must be logged in to manage quest proposals.");
	}

	return user;
}

function buildPRBody(
	submitterUsername: string,
	quests: Array<SeedsQuestDocument>,
	questlines: Array<SeedsQuestlineDocument>,
): string {
	const questList = quests.map((q) => `- **${q.name}** (${q.game})`).join("\n");
	const qlList =
		questlines.length > 0
			? `\n\n### Questlines\n${questlines.map((ql) => `- **${ql.name}**`).join("\n")}`
			: "";

	return `## Quest Proposal

Submitted by @${submitterUsername} via the Tachi Quest Editor.

### Quests
${questList}${qlList}

---
_This PR was automatically generated. Please review the quest content and goals before merging._`;
}

// ─── POST /proposals — Submit a new quest as a PR ─────────────────────────────

/**
 * Submit new quest(s) (and optional questlines) as a GitHub PR.
 *
 * @name POST /api/v1/proposals
 */
API_V1_ROUTER.add("POST /proposals", async ({ req, input }) => {
	requireGitHubConfig();

	const sessionUser = requireSession(req);

	// Only users who have been approved for quest submission may open PRs.
	const account = await DB.selectFrom("account")
		.select(["can_submit_quests"])
		.where("id", "=", sessionUser.id)
		.executeTakeFirst();

	if (!account?.can_submit_quests) {
		throw new ExpectedErr(
			403,
			"You do not have permission to submit quests. Apply via Discord to get access.",
		);
	}

	const {
		quests: rawQuests,
		questlines: rawQuestlines,
		prTitle,
	} = input as {
		prTitle?: string;
		questlines?: Array<RawQuestlineDocument>;
		quests: Array<RawQuestDocument>;
	};

	if (rawQuests.length === 0) {
		throw new ExpectedErr(400, "You must provide at least one quest.");
	}

	const { quests: seedQuests, goals: newGoals } = hydrateRawQuests(rawQuests);

	const questNameToID = new Map(rawQuests.map((raw, i) => [raw.name, seedQuests[i]!.questID]));

	const seedQuestlines = rawQuestlines ? hydrateRawQuestlines(rawQuestlines, questNameToID) : [];

	const octokit = await callGitHub(() => getInstallationOctokit());
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	// Read existing seed files from the repo
	const { content: existingQuestsRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/quests.json"),
	);
	const { content: existingGoalsRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/goals.json"),
	);
	const { content: existingQuestlinesRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/questlines.json"),
	);

	const existingQuests = JSON.parse(existingQuestsRaw) as Array<SeedsQuestDocument>;
	const existingGoals = JSON.parse(existingGoalsRaw) as Array<GoalDocument>;
	const existingQuestlines = JSON.parse(existingQuestlinesRaw) as Array<SeedsQuestlineDocument>;

	const {
		quests: mergedQuests,
		goals: mergedGoals,
		questlines: mergedQuestlines,
	} = mergeIntoSeeds({
		existingQuests,
		existingGoals,
		existingQuestlines,
		newQuests: seedQuests,
		newGoals,
		newQuestlines: seedQuestlines,
	});

	const branchSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	const branch = `quest-proposal/${branchSuffix}`;

	const questNames = seedQuests.map((q) => q.name).join(", ");
	const title = prTitle?.trim() || `Add quest: ${questNames}`;

	const prBody = buildPRBody(sessionUser.username, seedQuests, seedQuestlines);

	const prNumber = await callGitHub(() =>
		openOrUpdateProposalPR({
			octokit,
			branch,
			prTitle: title,
			prBody,
			changes: [
				{ path: "db/seeds/quests.json", content: JSON.stringify(mergedQuests, null, "\t") },
				{ path: "db/seeds/goals.json", content: JSON.stringify(mergedGoals, null, "\t") },
				...(mergedQuestlines !== existingQuestlines
					? [
							{
								path: "db/seeds/questlines.json",
								content: JSON.stringify(mergedQuestlines, null, "\t"),
							},
						]
					: []),
			],
		}),
	);

	const prUrl = `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}/pull/${prNumber}`;

	const row = await DB.insertInto("quest_proposal")
		.values({
			user_id: sessionUser.id,
			github_pr_number: prNumber,
			github_branch: branch,
			raw_quests: JSON.stringify(rawQuests),
			raw_questlines: JSON.stringify(rawQuestlines ?? []),
			status: "open",
		})
		.returning([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.created_at",
		])
		.executeTakeFirstOrThrow();

	return success(`Opened quest proposal PR #${prNumber}.`, {
		proposalID: row.row_id,
		prNumber: row.github_pr_number,
		prUrl,
		status: row.status,
	});
});

// ─── GET /proposals — List all open proposals ─────────────────────────────────

/**
 * List all open quest proposals (paginated, newest first).
 *
 * @name GET /api/v1/proposals
 */
API_V1_ROUTER.add("GET /proposals", async ({ input }) => {
	requireGitHubConfig();

	const page = Math.max(0, Number(input.page ?? 0));
	const limit = 20;

	const rows = await DB.selectFrom("quest_proposal")
		.innerJoin("account", "account.id", "quest_proposal.user_id")
		.select([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.raw_quests",
			"quest_proposal.created_at",
			"account.username",
		])
		.where("quest_proposal.status", "=", "open")
		.orderBy("quest_proposal.created_at", "desc")
		.limit(limit)
		.offset(page * limit)
		.execute();

	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const proposals = rows.map((row) => {
		const quests = (
			typeof row.raw_quests === "string"
				? (JSON.parse(row.raw_quests) as Array<RawQuestDocument>)
				: (row.raw_quests as unknown as Array<RawQuestDocument>)
		).map((q: RawQuestDocument) => ({ name: q.name, game: q.game }));

		return {
			proposalID: row.row_id,
			prNumber: row.github_pr_number,
			prUrl: `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}/pull/${row.github_pr_number}`,
			status: row.status,
			submitterUsername: row.username,
			quests,
			createdAt: row.created_at,
		};
	});

	return success(`Retrieved ${proposals.length} proposals.`, { proposals, page });
});

// ─── GET /proposals/mine — Current user's proposals ───────────────────────────

/**
 * List the calling user's quest proposals.
 *
 * @name GET /api/v1/proposals/mine
 */
API_V1_ROUTER.add("GET /proposals/mine", async ({ req }) => {
	requireGitHubConfig();

	const sessionUser = requireSession(req);

	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const rows = await DB.selectFrom("quest_proposal")
		.select([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.raw_quests",
			"quest_proposal.raw_questlines",
			"quest_proposal.created_at",
			"quest_proposal.updated_at",
		])
		.where("quest_proposal.user_id", "=", sessionUser.id)
		.orderBy("quest_proposal.created_at", "desc")
		.execute();

	const proposals = rows.map((row) => ({
		proposalID: row.row_id,
		prNumber: row.github_pr_number,
		prUrl: `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}/pull/${row.github_pr_number}`,
		status: row.status,
		rawQuests: typeof row.raw_quests === "string" ? JSON.parse(row.raw_quests) : row.raw_quests,
		rawQuestlines:
			typeof row.raw_questlines === "string"
				? JSON.parse(row.raw_questlines)
				: row.raw_questlines,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));

	return success(`Retrieved ${proposals.length} proposals.`, { proposals });
});

// ─── GET /proposals/:proposalID — Single proposal + live PR status ─────────────

/**
 * Get a single quest proposal, including its live PR status fetched from GitHub.
 *
 * @name GET /api/v1/proposals/:proposalID
 */
API_V1_ROUTER.add("GET /proposals/:proposalID", async ({ params }) => {
	requireGitHubConfig();

	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const row = await DB.selectFrom("quest_proposal")
		.innerJoin("account", "account.id", "quest_proposal.user_id")
		.select([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.raw_quests",
			"quest_proposal.raw_questlines",
			"quest_proposal.created_at",
			"quest_proposal.updated_at",
			"account.username",
		])
		.where("quest_proposal.row_id", "=", params.proposalID)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `No proposal found with ID '${params.proposalID}'.`);
	}

	// Fetch live PR status from GitHub (unless already closed/merged)
	let liveStatus: "closed" | "merged" | "open" = row.status as "closed" | "merged" | "open";

	if (row.status === "open") {
		try {
			liveStatus = await getPRStatus(row.github_pr_number);

			// Sync the DB if the status changed
			if (liveStatus !== row.status) {
				await DB.updateTable("quest_proposal")
					.set({ status: liveStatus, updated_at: new Date().toISOString() })
					.where("quest_proposal.row_id", "=", row.row_id)
					.execute();
			}
		} catch (err) {
			log.warn(
				{ err, prNumber: row.github_pr_number },
				"Failed to fetch live PR status from GitHub.",
			);
		}
	}

	return success(`Retrieved proposal ${params.proposalID}.`, {
		proposalID: row.row_id,
		prNumber: row.github_pr_number,
		prUrl: `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}/pull/${row.github_pr_number}`,
		status: liveStatus,
		submitterUsername: row.username,
		rawQuests: typeof row.raw_quests === "string" ? JSON.parse(row.raw_quests) : row.raw_quests,
		rawQuestlines:
			typeof row.raw_questlines === "string"
				? JSON.parse(row.raw_questlines)
				: row.raw_questlines,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});
});

// ─── PUT /proposals/:proposalID — Update quest data ────────────────────────────

/**
 * Update the quest content of an existing proposal, pushing a new commit to
 * the branch and updating the PR.
 *
 * @name PUT /api/v1/proposals/:proposalID
 */
API_V1_ROUTER.add("PUT /proposals/:proposalID", async ({ req, params, input }) => {
	requireGitHubConfig();

	const sessionUser = requireSession(req);

	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const row = await DB.selectFrom("quest_proposal")
		.select([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.user_id",
		])
		.where("quest_proposal.row_id", "=", params.proposalID)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `No proposal found with ID '${params.proposalID}'.`);
	}

	if (row.user_id !== sessionUser.id) {
		throw new ExpectedErr(403, "You can only update your own proposals.");
	}

	if (row.status !== "open") {
		throw new ExpectedErr(409, `Cannot update a proposal that is ${row.status}.`);
	}

	const {
		quests: rawQuests,
		questlines: rawQuestlines,
		prTitle,
	} = input as {
		prTitle?: string;
		questlines?: Array<RawQuestlineDocument>;
		quests: Array<RawQuestDocument>;
	};

	const { quests: seedQuests, goals: newGoals } = hydrateRawQuests(rawQuests);
	const questNameToID = new Map(rawQuests.map((raw, i) => [raw.name, seedQuests[i]!.questID]));
	const seedQuestlines = rawQuestlines ? hydrateRawQuestlines(rawQuestlines, questNameToID) : [];

	const octokit = await callGitHub(() => getInstallationOctokit());

	const { content: existingQuestsRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/quests.json"),
	);
	const { content: existingGoalsRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/goals.json"),
	);
	const { content: existingQuestlinesRaw } = await callGitHub(() =>
		readRepoFile(octokit, "db/seeds/questlines.json"),
	);

	const existingQuests = JSON.parse(existingQuestsRaw) as Array<SeedsQuestDocument>;
	const existingGoals = JSON.parse(existingGoalsRaw) as Array<GoalDocument>;
	const existingQuestlines = JSON.parse(existingQuestlinesRaw) as Array<SeedsQuestlineDocument>;

	const {
		quests: mergedQuests,
		goals: mergedGoals,
		questlines: mergedQuestlines,
	} = mergeIntoSeeds({
		existingQuests,
		existingGoals,
		existingQuestlines,
		newQuests: seedQuests,
		newGoals,
		newQuestlines: seedQuestlines,
	});

	const questNames = seedQuests.map((q) => q.name).join(", ");
	const title = prTitle?.trim() || `Add quest: ${questNames}`;
	const prBody = buildPRBody(sessionUser.username, seedQuests, seedQuestlines);

	await callGitHub(() =>
		openOrUpdateProposalPR({
			octokit,
			branch: row.github_branch,
			prTitle: title,
			prBody,
			changes: [
				{ path: "db/seeds/quests.json", content: JSON.stringify(mergedQuests, null, "\t") },
				{ path: "db/seeds/goals.json", content: JSON.stringify(mergedGoals, null, "\t") },
				...(mergedQuestlines !== existingQuestlines
					? [
							{
								path: "db/seeds/questlines.json",
								content: JSON.stringify(mergedQuestlines, null, "\t"),
							},
						]
					: []),
			],
			existingPrNumber: row.github_pr_number,
		}),
	);

	await DB.updateTable("quest_proposal")
		.set({
			raw_quests: JSON.stringify(rawQuests),
			raw_questlines: JSON.stringify(rawQuestlines ?? []),
			updated_at: new Date().toISOString(),
		})
		.where("quest_proposal.row_id", "=", row.row_id)
		.execute();

	return success(`Updated quest proposal PR #${row.github_pr_number}.`, {
		proposalID: row.row_id,
		prNumber: row.github_pr_number,
		prUrl: `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}/pull/${row.github_pr_number}`,
	});
});

// ─── DELETE /proposals/:proposalID — Withdraw a proposal ──────────────────────

/**
 * Close (withdraw) a quest proposal. Closes the GitHub PR and marks the row as
 * closed. Only the submitter or an admin may withdraw.
 *
 * @name DELETE /api/v1/proposals/:proposalID
 */
API_V1_ROUTER.add("DELETE /proposals/:proposalID", async ({ req, params }) => {
	requireGitHubConfig();

	const sessionUser = requireSession(req);
	const cfg = ServerConfig.GITHUB_APP_CONFIG!;

	const row = await DB.selectFrom("quest_proposal")
		.innerJoin("account", "account.id", "quest_proposal.user_id")
		.select([
			"quest_proposal.row_id",
			"quest_proposal.github_pr_number",
			"quest_proposal.github_branch",
			"quest_proposal.status",
			"quest_proposal.user_id",
			"account.auth_level",
		])
		.where("quest_proposal.row_id", "=", params.proposalID)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `No proposal found with ID '${params.proposalID}'.`);
	}

	const isOwner = row.user_id === sessionUser.id;
	const isAdmin = row.auth_level === "admin";

	if (!isOwner && !isAdmin) {
		throw new ExpectedErr(403, "You can only withdraw your own proposals.");
	}

	if (row.status !== "open") {
		throw new ExpectedErr(409, `Proposal is already ${row.status}.`);
	}

	// Close the PR on GitHub
	try {
		const octokit = await getInstallationOctokit();

		await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
			owner: cfg.REPO_OWNER,
			repo: cfg.REPO_NAME,
			pull_number: row.github_pr_number,
			state: "closed",
		});
	} catch (err) {
		log.warn(
			{ err, prNumber: row.github_pr_number },
			"Failed to close GitHub PR when withdrawing proposal.",
		);
	}

	await DB.updateTable("quest_proposal")
		.set({ status: "closed", updated_at: new Date().toISOString() })
		.where("quest_proposal.row_id", "=", row.row_id)
		.execute();

	return success("Proposal withdrawn.", { proposalID: row.row_id });
});

// ─── POST /proposals/webhook/merged — github-bot notification ─────────────────

/**
 * Called by the github-bot when a quest-proposal PR is merged.
 * Validates a shared secret header and marks the matching proposal as merged.
 *
 * @name POST /api/v1/proposals/webhook/merged
 */
API_V1_ROUTER.add("POST /proposals/webhook/merged", async ({ req, input }) => {
	const cfg = requireGitHubConfig();

	const secret = req.headers["x-tachi-webhook-secret"];

	if (secret !== cfg.WEBHOOK_SECRET) {
		throw new ExpectedErr(401, "Invalid webhook secret.");
	}

	const { prNumber } = input as { prNumber: number };

	if (typeof prNumber !== "number") {
		throw new ExpectedErr(400, "prNumber must be a number.");
	}

	const result = await DB.updateTable("quest_proposal")
		.set({ status: "merged", updated_at: new Date().toISOString() })
		.where("quest_proposal.github_pr_number", "=", prNumber)
		.where("quest_proposal.status", "=", "open")
		.returning("quest_proposal.row_id")
		.executeTakeFirst();

	if (!result) {
		// Not necessarily an error — bot may call this for non-proposal PRs too
		return success("No matching open proposal for this PR.", { updated: false });
	}

	log.info({ prNumber, proposalID: result.row_id }, "Quest proposal marked as merged.");

	return success("Proposal marked as merged.", { updated: true, proposalID: result.row_id });
});
