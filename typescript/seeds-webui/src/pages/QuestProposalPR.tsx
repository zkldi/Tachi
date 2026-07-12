/**
 * Quest Proposal PR page — /pr/:prNumber
 *
 * Shows the quests and questlines introduced by a quest-proposal/* branch PR.
 * Fetches the PR head/base SHAs from the GitHub API, then loads the relevant
 * seed files from raw.githubusercontent to compute which quests are new or
 * updated compared to the base branch.
 */

import { GITHUB_PAT_KEY, SEEDS_GITHUB_HTML_URL, SEEDS_REPO } from "#lib/config";
import { getTransport } from "#lib/transport/transport";
import { useMemo } from "react";
import { useQuery } from "react-query";
import { Link, useParams } from "react-router-dom";

// ─── Local seed-doc types (mirrors tachi-common seeds shape) ─────────────────

type QuestGoalRef = {
	goalID: string;
	note?: string;
};

type QuestSection = {
	goals: QuestGoalRef[];
	title?: string;
};

type SeedsQuestDoc = {
	desc: string;
	game: string;
	name: string;
	questData: QuestSection[];
	questID: string;
};

type SeedsQuestlineDoc = {
	desc: string;
	game: string;
	name: string;
	questlineID: string;
	quests: Array<{ questID: string }>;
};

type SeedsGoalDoc = {
	game: string;
	goalID: string;
	name: string;
};

// ─── GitHub helpers ───────────────────────────────────────────────────────────

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

async function ghFetch<T>(pathname: string): Promise<T> {
	const res = await fetch(`https://api.github.com${pathname}`, { headers: ghHeaders() });
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`GitHub ${pathname}: HTTP ${res.status} ${text}`);
	}
	return (await res.json()) as T;
}

type GhPR = {
	base: { ref: string; sha: string };
	body: string | null;
	head: { ref: string; sha: string };
	html_url: string;
	number: number;
	state: string;
	title: string;
	user: { avatar_url: string; login: string };
};

// ─── Data hooks ──────────────────────────────────────────────────────────────

function usePR(prNumber: number) {
	return useQuery(
		["gh-pr", prNumber],
		() => ghFetch<GhPR>(`/repos/${SEEDS_REPO}/pulls/${prNumber}`),
		{ retry: 1, staleTime: 120_000 },
	);
}

function useSeedFile<T>(file: string, sha: string | undefined) {
	return useQuery<T[]>(
		["seed-file", file, sha ?? "__none__"],
		async () => {
			if (!sha) {
				return [];
			}
			const t = await getTransport();
			return (await t.getCollection(file, sha)) as T[];
		},
		{ enabled: Boolean(sha), staleTime: 120_000 },
	);
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function diffById<T extends { [k: string]: unknown }>(
	idKey: keyof T,
	base: T[],
	head: T[],
): { added: T[]; changed: T[]; unchanged: T[] } {
	const baseMap = new Map(base.map((x) => [x[idKey] as string, x]));
	const headMap = new Map(head.map((x) => [x[idKey] as string, x]));

	const added: T[] = [];
	const changed: T[] = [];
	const unchanged: T[] = [];

	for (const [id, item] of headMap) {
		const baseItem = baseMap.get(id);
		if (!baseItem) {
			added.push(item);
		} else if (JSON.stringify(item) !== JSON.stringify(baseItem)) {
			changed.push(item);
		} else {
			unchanged.push(item);
		}
	}

	return { added, changed, unchanged };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: string }) {
	const cls =
		state === "open" ? "badge-open" : state === "closed" ? "badge-closed" : "badge-merged";
	return <span className={`pr-status-badge ${cls}`}>{state}</span>;
}

function GoalChip({ goal }: { goal: SeedsGoalDoc }) {
	return (
		<span className="goal-chip" title={goal.goalID}>
			{goal.name}
		</span>
	);
}

function QuestCard({
	badge,
	goals,
	quest,
}: {
	badge: "new" | "updated";
	goals: Map<string, SeedsGoalDoc>;
	quest: SeedsQuestDoc;
}) {
	return (
		<div className="quest-card">
			<div className="quest-card-header">
				<span className={`quest-badge quest-badge-${badge}`}>
					{badge === "new" ? "New" : "Updated"}
				</span>
				<span className="quest-game">{quest.game}</span>
				<strong className="quest-name">{quest.name}</strong>
			</div>
			{quest.desc && <p className="quest-desc">{quest.desc}</p>}
			<div className="quest-sections">
				{quest.questData.map((section, si) => (
					<div className="quest-section" key={si}>
						{section.title && <p className="quest-section-title">{section.title}</p>}
						<div className="quest-goals">
							{section.goals.map((ref) => {
								const g = goals.get(ref.goalID);
								return g ? (
									<span key={ref.goalID}>
										<GoalChip goal={g} />
										{ref.note && (
											<span className="goal-note"> — {ref.note}</span>
										)}
									</span>
								) : (
									<span
										className="goal-chip goal-chip-missing"
										key={ref.goalID}
										title={ref.goalID}
									>
										(unknown goal)
									</span>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function QuestlineCard({
	badge,
	questline,
	questsByID,
}: {
	badge: "new" | "updated";
	questline: SeedsQuestlineDoc;
	questsByID: Map<string, SeedsQuestDoc>;
}) {
	return (
		<div className="quest-card">
			<div className="quest-card-header">
				<span className={`quest-badge quest-badge-${badge}`}>
					{badge === "new" ? "New" : "Updated"}
				</span>
				<span className="quest-game">{questline.game}</span>
				<strong className="quest-name">{questline.name}</strong>
			</div>
			{questline.desc && <p className="quest-desc">{questline.desc}</p>}
			<div className="questline-quests">
				{questline.quests.map((ref, i) => {
					const q = questsByID.get(ref.questID);
					return (
						<span className="questline-step" key={ref.questID}>
							<span className="questline-step-num">{i + 1}</span>
							{q ? q.name : <em title={ref.questID}>(unknown quest)</em>}
						</span>
					);
				})}
			</div>
		</div>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function QuestProposalPR() {
	const { prNumber: prNumberStr } = useParams<{ prNumber: string }>();
	const prNumber = parseInt(prNumberStr, 10);

	const pr = usePR(prNumber);

	const headSha = pr.data?.head.sha;
	const baseSha = pr.data?.base.sha;

	const headQuests = useSeedFile<SeedsQuestDoc>("quests.json", headSha);
	const headGoals = useSeedFile<SeedsGoalDoc>("goals.json", headSha);
	const headQuestlines = useSeedFile<SeedsQuestlineDoc>("questlines.json", headSha);

	const baseQuests = useSeedFile<SeedsQuestDoc>("quests.json", baseSha);
	const baseGoals = useSeedFile<SeedsGoalDoc>("goals.json", baseSha);
	const baseQuestlines = useSeedFile<SeedsQuestlineDoc>("questlines.json", baseSha);

	const questDiff = useMemo(
		() =>
			headQuests.data && baseQuests.data
				? diffById("questID", baseQuests.data, headQuests.data)
				: null,
		[headQuests.data, baseQuests.data],
	);

	const questlineDiff = useMemo(
		() =>
			headQuestlines.data && baseQuestlines.data
				? diffById("questlineID", baseQuestlines.data, headQuestlines.data)
				: null,
		[headQuestlines.data, baseQuestlines.data],
	);

	// Build lookup maps
	const headGoalsByID = useMemo(
		() => new Map((headGoals.data ?? []).map((g) => [g.goalID, g])),
		[headGoals.data],
	);

	// All head quests by ID (for questline resolution)
	const headQuestsByID = useMemo(
		() => new Map((headQuests.data ?? []).map((q) => [q.questID, q])),
		[headQuests.data],
	);

	const isLoading =
		pr.isLoading ||
		headQuests.isLoading ||
		headGoals.isLoading ||
		headQuestlines.isLoading ||
		baseQuests.isLoading ||
		baseGoals.isLoading ||
		baseQuestlines.isLoading;

	const error = pr.error ?? headQuests.error ?? headQuestlines.error ?? baseQuests.error;

	if (Number.isNaN(prNumber)) {
		return (
			<div>
				<h2 className="page-title">Invalid PR</h2>
				<p className="page-subtitle">
					The PR number in the URL is not valid. <Link to="/">Go home</Link>.
				</p>
			</div>
		);
	}

	if (pr.error) {
		return (
			<div>
				<h2 className="page-title">PR #{prNumber}</h2>
				<p className="page-subtitle text-danger">
					Could not load PR: {String(pr.error)}. It may not exist, or it may be a private
					repo.
				</p>
				<p>
					<a
						href={`${SEEDS_GITHUB_HTML_URL}/pull/${prNumber}`}
						rel="noopener noreferrer"
						target="_blank"
					>
						View on GitHub
					</a>
				</p>
			</div>
		);
	}

	const diffParams = pr.data
		? new URLSearchParams({
				base: pr.data.base.sha,
				head: pr.data.head.sha,
				file: "quests.json",
				pr: String(prNumber),
			}).toString()
		: null;

	const isQuestProposal = pr.data?.head.ref.startsWith("quest-proposal/") ?? false;

	return (
		<div>
			{/* ── PR header ────────────────────────────────────────────── */}
			<div className="pr-header">
				<div className="pr-header-main">
					<h2 className="page-title">{pr.data ? pr.data.title : `PR #${prNumber}`}</h2>
					{pr.data && (
						<div className="pr-meta">
							<StatusBadge state={pr.data.state} />
							{isQuestProposal && (
								<span className="quest-proposal-tag">Quest Proposal</span>
							)}
							<span className="pr-author">
								<img
									alt={pr.data.user.login}
									className="pr-avatar"
									src={pr.data.user.avatar_url}
								/>
								{pr.data.user.login}
							</span>
							<span className="pr-branch">
								<code>{pr.data.head.ref}</code>
							</span>
						</div>
					)}
				</div>
				<div className="pr-header-actions">
					{pr.data && (
						<a
							className="btn-ghost"
							href={pr.data.html_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							GitHub ↗
						</a>
					)}
					{diffParams && (
						<Link className="btn-ghost" to={`/diff?${diffParams}`}>
							Seed Diff ↗
						</Link>
					)}
				</div>
			</div>

			{/* ── Loading state ─────────────────────────────────────────── */}
			{isLoading && <p className="page-subtitle">Loading seed data from GitHub…</p>}

			{error && !pr.error && (
				<p className="text-danger">Error loading seed files: {String(error)}</p>
			)}

			{/* ── Quest diff ────────────────────────────────────────────── */}
			{questDiff && (
				<section className="mb-4">
					<h3 className="section-title">
						Quests
						{questDiff.added.length > 0 && (
							<span className="section-count section-count-added">
								+{questDiff.added.length} new
							</span>
						)}
						{questDiff.changed.length > 0 && (
							<span className="section-count section-count-changed">
								{questDiff.changed.length} updated
							</span>
						)}
					</h3>

					{questDiff.added.length === 0 && questDiff.changed.length === 0 && (
						<p className="page-subtitle">No quest changes in this PR.</p>
					)}

					<div className="quest-grid">
						{questDiff.added.map((q) => (
							<QuestCard
								badge="new"
								goals={headGoalsByID}
								key={q.questID}
								quest={q}
							/>
						))}
						{questDiff.changed.map((q) => (
							<QuestCard
								badge="updated"
								goals={headGoalsByID}
								key={q.questID}
								quest={q}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Questline diff ────────────────────────────────────────── */}
			{questlineDiff &&
				(questlineDiff.added.length > 0 || questlineDiff.changed.length > 0) && (
					<section className="mb-4">
						<h3 className="section-title">
							Questlines
							{questlineDiff.added.length > 0 && (
								<span className="section-count section-count-added">
									+{questlineDiff.added.length} new
								</span>
							)}
							{questlineDiff.changed.length > 0 && (
								<span className="section-count section-count-changed">
									{questlineDiff.changed.length} updated
								</span>
							)}
						</h3>
						<div className="quest-grid">
							{questlineDiff.added.map((ql) => (
								<QuestlineCard
									badge="new"
									key={ql.questlineID}
									questline={ql}
									questsByID={headQuestsByID}
								/>
							))}
							{questlineDiff.changed.map((ql) => (
								<QuestlineCard
									badge="updated"
									key={ql.questlineID}
									questline={ql}
									questsByID={headQuestsByID}
								/>
							))}
						</div>
					</section>
				)}

			{/* ── No quest proposal notice ──────────────────────────────── */}
			{pr.data && !isQuestProposal && !isLoading && (
				<div className="pr-not-quest-proposal">
					<p>
						This PR (<code>{pr.data.head.ref}</code>) is not a{" "}
						<code>quest-proposal/*</code> branch. The diff above shows any
						quest/questline changes it contains, but it was not submitted through the
						quest editor.
					</p>
					<p>
						<Link to={`/diff?${diffParams}`}>View the full seed diff →</Link>
					</p>
				</div>
			)}

			{/* ── PR body ───────────────────────────────────────────────── */}
			{pr.data?.body && (
				<details className="pr-body-details">
					<summary>PR description</summary>
					<pre className="pr-body-pre">{pr.data.body}</pre>
				</details>
			)}
		</div>
	);
}
