import { useIngest } from "#lib/ingest/IngestProvider";
import { useEffect, useState } from "react";

// Bottom-right toast that surfaces sqlite ingest progress from anywhere in
// the app. Stays pinned while ingesting; auto-hides ~1.5s after completion.
export function IngestToast() {
	const { error, progress, ready } = useIngest();
	const [visible, setVisible] = useState(false);
	const [hiding, setHiding] = useState(false);

	useEffect(() => {
		if (error || (!ready && progress)) {
			setVisible(true);
			setHiding(false);
			return;
		}

		if (ready && visible) {
			setHiding(true);
			const t = setTimeout(() => {
				setVisible(false);
				setHiding(false);
			}, 1500);
			return () => clearTimeout(t);
		}
	}, [error, progress, ready, visible]);

	if (!visible) {
		return null;
	}

	const pct =
		progress && progress.total > 0
			? Math.round(((progress.idx + 1) / progress.total) * 100)
			: 0;

	return (
		<div
			aria-live="polite"
			className={`ingest-toast ${hiding ? "is-hiding" : ""} ${error ? "is-error" : ""}`}
			role="status"
		>
			<div className="ingest-toast-head">
				{error ? (
					<>
						<span className="ingest-dot dot-error" />
						<strong>Ingest failed</strong>
					</>
				) : ready ? (
					<>
						<span className="ingest-dot dot-ok" />
						<strong>Database ready</strong>
					</>
				) : (
					<>
						<span className="ingest-spinner" />
						<strong>Loading seeds</strong>
						<span className="ingest-count">
							{progress ? `${progress.idx + 1}/${progress.total}` : ""}
						</span>
					</>
				)}
			</div>
			{!ready && !error && progress ? (
				<>
					<div className="ingest-file mono">
						<span className="ingest-file-name">{progress.name}</span>
						<span className="ingest-file-meta">
							{progress.cached ? "cached" : `${progress.rows.toLocaleString()} rows`}
						</span>
					</div>
					<div className="ingest-bar">
						<div className="ingest-bar-fill" style={{ width: `${pct}%` }} />
					</div>
				</>
			) : null}
			{error ? <div className="ingest-error-msg mono">{error}</div> : null}
		</div>
	);
}
