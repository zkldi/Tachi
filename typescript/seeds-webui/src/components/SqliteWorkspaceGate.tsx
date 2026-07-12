import type { ReactNode } from "react";

import { useIngest } from "#lib/ingest/IngestProvider";

type SqliteWorkspaceGateProps = { children: ReactNode };

/**
 * Renders the SQLite-driven workspace (CodeMirror, schema, run results) only after
 * ingest finished. While transport or seeds load, shows a full-width placeholder
 * that matches the editor area so the rest of the app (nav, other routes) stays usable.
 */
export function SqliteWorkspaceGate({ children }: SqliteWorkspaceGateProps) {
	const { error: ingestError, progress, ready, transportError, transportLoading } = useIngest();

	if (ready) {
		return <>{children}</>;
	}

	const errMsg = transportError ?? ingestError;
	const pct =
		progress && progress.total > 0
			? Math.round(((progress.idx + 1) / progress.total) * 100)
			: 0;

	return (
		<div aria-busy="true" className="sql-workspace-gate" role="status">
			{errMsg ? (
				<div className="alert alert-danger sql-workspace-gate-inner mono mb-0" role="alert">
					<strong className="d-block text-danger-emphasis mb-1">
						SQLite not available
					</strong>
					{errMsg}
				</div>
			) : (
				<div className="sql-workspace-gate-inner">
					<div className="d-flex align-items-center gap-2 flex-wrap">
						<span
							aria-hidden="true"
							className="spinner-border spinner-border-sm text-primary"
						/>
						<strong>Loading seeds into SQLite</strong>
					</div>
					{transportLoading ? (
						<p className="text-muted small mb-2">Connecting to seeds data…</p>
					) : null}
					{progress ? (
						<>
							<div className="d-flex small text-muted flex-wrap align-items-baseline gap-2 mb-1">
								<span className="mono text-body-secondary">{progress.name}</span>
								<span>
									{progress.idx + 1} / {progress.total}
									{progress.cached
										? " · cached"
										: ` · ${progress.rows.toLocaleString()} rows`}
								</span>
							</div>
							{progress.total > 0 ? (
								<div
									aria-label="Ingest progress"
									aria-valuemax={100}
									aria-valuemin={0}
									aria-valuenow={pct}
									className="ingest-bar sql-workspace-gate-bar"
									role="progressbar"
								>
									<div className="ingest-bar-fill" style={{ width: `${pct}%` }} />
								</div>
							) : null}
						</>
					) : !transportLoading ? (
						<p className="text-muted small mb-0">Preparing the database…</p>
					) : null}
				</div>
			)}
		</div>
	);
}
