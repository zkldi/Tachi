import type { V3Game } from "tachi-common/types";

import { DiffRows } from "#components/CollectionDiffRows";
import { SEEDS_GITHUB_HTML_URL } from "#lib/config";
import { type Row, summariseDiff } from "#lib/diff/collection-diff";
import { type Commit, getTransport } from "#lib/transport/transport";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { Link, useHistory, useLocation } from "react-router-dom";
import { GameToGameGroup } from "tachi-common/config/config";

function mergeSongRowsById(baseSongs: Row[], headSongs: Row[]): Map<string, Row> {
	const m = new Map<string, Row>();
	for (const r of baseSongs) {
		if (typeof r.id === "string") {
			m.set(r.id, r);
		}
	}
	for (const r of headSongs) {
		if (typeof r.id === "string") {
			m.set(r.id, r);
		}
	}
	return m;
}

function useQueryParams() {
	const location = useLocation();
	return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

// ---------------------------------------------------------------------------

function CommitPicker() {
	const [listFilter, setListFilter] = useState("");

	const files = useQuery("collections", async () => (await getTransport()).listCollections());
	const commits = useQuery(["commits", listFilter], async () => {
		const t = await getTransport();
		return t.listCommits({ file: listFilter || undefined });
	});

	return (
		<>
			<p className="page-subtitle">
				Commits that touched <code>db/seeds</code> (or a specific file). Pick one to diff it
				against its parent.
			</p>

			<div className="mb-3">
				<label className="form-label">File filter</label>
				<select
					className="form-select"
					onChange={(e) => setListFilter(e.target.value)}
					value={listFilter}
				>
					<option value="">All seeds</option>
					{(files.data ?? []).map((n) => (
						<option key={n} value={n}>
							{n}
						</option>
					))}
				</select>
			</div>

			<div className="spacer-y">
				{(commits.data?.commits ?? []).map((c) => (
					<Link
						className="row-link"
						key={c.sha}
						to={`/diff?base=${c.parents[0]?.sha ?? ""}&head=${c.sha}${
							listFilter ? `&file=${encodeURIComponent(listFilter)}` : ""
						}`}
					>
						<code className="sha">{c.sha.slice(0, 7)}</code>
						<span className="subject">{c.message.split("\n")[0]}</span>
						<span className="meta">
							{c.author.name} · {new Date(c.author.date).toLocaleDateString()}
						</span>
					</Link>
				))}
			</div>
		</>
	);
}

export function Diff() {
	const history = useHistory();
	const location = useLocation();
	const params = useQueryParams();
	const base = params.get("base") ?? "";
	const head = params.get("head") ?? "";
	const explicitPrNumber = useMemo(() => {
		const raw = params.get("pr");
		if (raw && /^\d+$/u.test(raw)) {
			return Number(raw);
		}
		return null;
	}, [params]);
	const hasPair = Boolean(base && head);

	// Legacy boku.tachi.ac/utils/seeds links used ?repo=&sha=&compareRepo=&compareSHA=.
	useEffect(() => {
		const p = new URLSearchParams(location.search);
		if (p.get("base") && p.get("head")) {
			return;
		}
		const sha = p.get("sha");
		const compareSHA = p.get("compareSHA");
		const repo = p.get("repo");
		const compareRepo = p.get("compareRepo");
		if (sha && compareSHA && repo && compareRepo) {
			const next = new URLSearchParams();
			next.set("base", sha);
			next.set("head", compareSHA);
			const pr = p.get("pr");
			if (pr) {
				next.set("pr", pr);
			}
			const file = p.get("file");
			if (file) {
				next.set("file", file);
			}
			history.replace(`${location.pathname}?${next.toString()}`);
		}
	}, [history, location.pathname, location.search]);

	const files = useQuery("collections", async () => (await getTransport()).listCollections());
	const [file, setFile] = useState(() => {
		const p = new URLSearchParams(location.search);
		if (!p.get("base") || !p.get("head")) {
			return "folders.json";
		}
		return p.get("file") ?? "folders.json";
	});
	const [filter, setFilter] = useState("");
	const [kindFilter, setKindFilter] = useState<"added" | "all" | "changed" | "removed">("all");

	useEffect(() => {
		if (!hasPair) {
			return;
		}
		const p = new URLSearchParams(location.search);
		setFile(p.get("file") ?? "folders.json");
	}, [hasPair, location.search]);

	const headCommit = useQuery(
		["commit", head],
		async () => {
			if (!head) {
				return null;
			}
			const t = await getTransport();
			return t.getCommit(head);
		},
		{ enabled: !!head, staleTime: 60_000 },
	);

	const pair = useQuery(
		["pair", base, head, file],
		async () => {
			if (!base || !head || !file) {
				return null;
			}
			const t = await getTransport();
			const [a, b] = await Promise.all([
				t.getCollection(file, base),
				t.getCollection(file, head),
			]);

			let songById: Map<string, Row> | undefined;
			if (file.startsWith("charts-")) {
				const game = file.replace(/^charts-/u, "").replace(/\.json$/u, "") as V3Game;
				const songFile = `songs-${GameToGameGroup(game)}.json`;
				const [sa, sb] = await Promise.all([
					t.getCollection(songFile, base),
					t.getCollection(songFile, head),
				]);
				songById = mergeSongRowsById(sa as Row[], sb as Row[]);
			}

			return { a, b, songById };
		},
		{ enabled: !!base && !!head && !!file },
	);

	const summary = useMemo(() => {
		if (!pair.data) {
			return null;
		}
		return summariseDiff(pair.data.a, pair.data.b, {
			collectionName: file,
			songById: pair.data.songById,
		});
	}, [pair.data, file]);

	const filteredRows = useMemo(() => {
		if (!summary) {
			return [];
		}
		const q = filter.trim().toLowerCase();
		return summary.rows.filter((r) => {
			const kindOk =
				kindFilter === "all" ||
				(kindFilter === "added" && r.kind === "added") ||
				(kindFilter === "removed" && r.kind === "removed") ||
				(kindFilter === "changed" && r.kind === "changed");
			if (!kindOk) {
				return false;
			}
			if (!q) {
				return true;
			}
			return r.id.toLowerCase().includes(q) || r.pretty.toLowerCase().includes(q);
		});
	}, [summary, filter, kindFilter]);

	return (
		<div>
			<h2 className="page-title">Diff</h2>
			{!hasPair ? (
				<CommitPicker />
			) : (
				<>
					<p className="mb-3">
						<Link to="/diff">← Choose another commit</Link>
					</p>
					<CommitHeader
						base={base}
						commit={headCommit.data ?? null}
						explicitPrNumber={explicitPrNumber}
						head={head}
						loading={headCommit.isLoading}
					/>

					<div className="diff-controls mb-3">
						<div className="control">
							<label className="form-label">Collection</label>
							<select
								className="form-select"
								onChange={(e) => setFile(e.target.value)}
								value={file}
							>
								{(files.data ?? []).map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</div>
						<div className="control control-grow">
							<label className="form-label">Filter rows</label>
							<input
								className="form-control"
								onChange={(e) => setFilter(e.target.value)}
								placeholder="matches primary key (id=…) or formatted label"
								value={filter}
							/>
						</div>
						<div className="control">
							<label className="form-label">Show</label>
							<div className="btn-group" role="group">
								{(["all", "added", "removed", "changed"] as const).map((k) => (
									<button
										className={`btn btn-sm ${
											kindFilter === k
												? "btn-primary"
												: "btn-outline-secondary"
										}`}
										key={k}
										onClick={() => setKindFilter(k)}
										type="button"
									>
										{k}
									</button>
								))}
							</div>
						</div>
					</div>

					{pair.isLoading ? <p>Loading…</p> : null}
					{pair.isError ? (
						<p className="text-danger">Failed to load pair: {String(pair.error)}</p>
					) : null}

					{summary ? (
						<div className="diff-badges mb-3">
							<span className="badge bg-success">+{summary.added} added</span>
							<span className="badge bg-danger">−{summary.removed} removed</span>
							<span className="badge bg-warning text-dark">
								~{summary.changed} changed
							</span>
							<span className="diff-badges-meta">
								showing {filteredRows.length.toLocaleString()} of{" "}
								{summary.rows.length.toLocaleString()}
							</span>
						</div>
					) : null}

					{summary ? <DiffRows rows={filteredRows} /> : null}
				</>
			)}
		</div>
	);
}

// Look for "(#123)" or "#123" in a commit message (squash-merge / GitHub auto-
// references). Falls back to the "Merge pull request #123" style from merge
// commits. Returns a PR number or null.
function extractPrNumber(message: string): number | null {
	const parens = message.match(/\(#(\d+)\)/u);
	if (parens?.[1]) {
		return Number(parens[1]);
	}
	const merge = message.match(/Merge pull request #(\d+)/u);
	if (merge?.[1]) {
		return Number(merge[1]);
	}
	const hash = message.match(/(?:^|\s)#(\d+)(?:\s|$)/mu);
	if (hash?.[1]) {
		return Number(hash[1]);
	}
	return null;
}

function formatCommitDate(iso: string | undefined): string {
	if (!iso) {
		return "";
	}
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		return iso;
	}
	return d.toLocaleString(undefined, {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function CommitHeader({
	base,
	head,
	commit,
	explicitPrNumber,
	loading,
}: {
	base: string;
	commit: Commit | null;
	explicitPrNumber: number | null;
	head: string;
	loading: boolean;
}) {
	const subject = commit?.message.split("\n")[0] ?? "";
	const body = commit?.message.split("\n").slice(1).join("\n").trim() ?? "";
	const prNumber = explicitPrNumber ?? (commit ? extractPrNumber(commit.message) : null);

	const commitUrl = `${SEEDS_GITHUB_HTML_URL}/commit/${head}`;
	const compareUrl = `${SEEDS_GITHUB_HTML_URL}/compare/${base}...${head}`;
	const prUrl = prNumber ? `${SEEDS_GITHUB_HTML_URL}/pull/${prNumber}` : null;

	return (
		<div className="commit-header mb-4">
			<div className="commit-header-main">
				<div aria-hidden="true" className="commit-header-avatar">
					{(commit?.author.name ?? "?").slice(0, 1).toUpperCase()}
				</div>
				<div className="commit-header-body">
					<div className="commit-header-subject">
						{loading ? "Loading commit…" : subject || <em>(no message)</em>}
					</div>
					<div className="commit-header-meta">
						<span>
							<strong>{commit?.author.name ?? "-"}</strong>
							{commit?.author.email ? (
								<span className="text-muted"> &lt;{commit.author.email}&gt;</span>
							) : null}
						</span>
						<span className="commit-header-dot">·</span>
						<span>{formatCommitDate(commit?.author.date)}</span>
						{commit?.committer && commit.committer.email !== commit.author.email ? (
							<>
								<span className="commit-header-dot">·</span>
								<span className="text-muted">
									committed by {commit.committer.name}
								</span>
							</>
						) : null}
					</div>
					{body ? <pre className="commit-header-body-text">{body}</pre> : null}
				</div>
			</div>

			<div className="commit-header-refs mono">
				<span className="commit-ref">
					<span className="label">base</span>
					<a
						href={`${SEEDS_GITHUB_HTML_URL}/commit/${base}`}
						rel="noreferrer"
						target="_blank"
					>
						<code>{base.slice(0, 7)}</code>
					</a>
				</span>
				<span className="commit-arrow">→</span>
				<span className="commit-ref">
					<span className="label">head</span>
					<a href={commitUrl} rel="noreferrer" target="_blank">
						<code>{head.slice(0, 7)}</code>
					</a>
				</span>
			</div>

			<div className="commit-header-actions">
				{prUrl ? (
					<a
						className="btn btn-sm btn-primary"
						href={prUrl}
						rel="noreferrer"
						target="_blank"
					>
						View PR #{prNumber}
					</a>
				) : null}
				<a
					className="btn btn-sm btn-outline-secondary"
					href={commitUrl}
					rel="noreferrer"
					target="_blank"
				>
					View commit on GitHub
				</a>
				<a
					className="btn btn-sm btn-outline-secondary"
					href={compareUrl}
					rel="noreferrer"
					target="_blank"
				>
					Compare {base.slice(0, 7)}…{head.slice(0, 7)}
				</a>
			</div>
		</div>
	);
}
