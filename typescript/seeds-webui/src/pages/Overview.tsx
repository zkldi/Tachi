import { CommitSparkline } from "#components/CommitSparkline";
import { useIngest } from "#lib/ingest/IngestProvider";
import { getSqlite } from "#lib/sqlite/client";
import { getTransport } from "#lib/transport/transport";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";

// SQLite table name -> original collection file name. The ingest code does
// `name.replace(/\.json$/, "").replace(/-/g, "_")`; none of the existing
// seeds files contain a literal underscore, so this reverse is lossless.
function tableToCollection(table: string): string {
	return `${table.replace(/_/gu, "-")}.json`;
}

export function Overview() {
	const { ready } = useIngest();

	const counts = useQuery("table-counts", () => getSqlite().tableCounts(), {
		enabled: ready,
		staleTime: 30_000,
	});
	// We fetch a moderately deep commit history once and slice it two ways:
	// the first 10 for the "recent commits" list, and the whole range for
	// the sparkline. listCommits returns at most one page (~100 commits)
	// which is plenty for a 90-day pulse.
	const commitHistory = useQuery(
		"commit-history",
		async () => {
			const t = await getTransport();
			return (await t.listCommits({})).commits;
		},
		{ staleTime: 60_000 },
	);
	const recentCommits = (commitHistory.data ?? []).slice(0, 10);

	const totalRows = (counts.data ?? []).reduce((s, c) => s + c.rows, 0);

	return (
		<div>
			<h2 className="page-title">Overview</h2>
			<p className="page-subtitle">
				Query the seeds database in-browser, walk through git history, and inspect changes.
			</p>

			<div className="stat-grid mb-4">
				<StatCard label="Tables" value={counts.data ? counts.data.length : "…"} />
				<StatCard
					label="Total rows"
					value={counts.data ? totalRows.toLocaleString() : "…"}
				/>
				<StatCard label="Recent commits" value={commitHistory.data?.length ?? "…"} />
			</div>

			{commitHistory.data ? (
				<section className="mb-4">
					<CommitSparkline commits={commitHistory.data} />
				</section>
			) : null}

			<section className="mb-4">
				<h4 className="mb-2">Collections</h4>
				<div className="spacer-y">
					{counts.data
						? counts.data.map((c) => {
								const collection = tableToCollection(c.name);
								return (
									<Link
										className="row-link"
										key={c.name}
										to={`/c/${encodeURIComponent(collection)}`}
									>
										<span className="subject mono">{collection}</span>
										<span className="row-count">
											{c.rows.toLocaleString()} rows
										</span>
									</Link>
								);
							})
						: Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)}
				</div>
			</section>

			<section>
				<h4 className="mb-2">Recent commits</h4>
				<div className="spacer-y">
					{commitHistory.data
						? recentCommits.map((c) => (
								<Link
									className="row-link"
									key={c.sha}
									to={`/diff?base=${c.parents[0]?.sha ?? ""}&head=${c.sha}`}
								>
									<code className="sha">{c.sha.slice(0, 7)}</code>
									<span className="subject">{c.message.split("\n")[0]}</span>
									<span className="meta">
										{c.author.name} ·{" "}
										{new Date(c.author.date).toLocaleDateString()}
									</span>
								</Link>
							))
						: Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)}
				</div>
			</section>
		</div>
	);
}

function SkeletonRow() {
	return <div aria-hidden="true" className="skeleton-row" />;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="stat-card">
			<div className="stat-label">{label}</div>
			<div className="stat-value">{value}</div>
		</div>
	);
}
