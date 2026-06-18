import { ToAPIURL } from "#util/api";
import { useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";

interface ActiveJob {
	jobId: string;
	userId: number | null;
	username: string | null;
	importType: string;
	importId: string;
	startedAt: string;
}

interface SnapshotEvent {
	activeJobs: ActiveJob[];
	queueDepth: number;
	/** Set by the worker process on startup; null if worker hasn't advertised its pool size yet. */
	workerCount: number | null;
}

interface JobStartEvent {
	type: "job:start";
	jobId: string;
	userId: number;
	importType: string;
	importId: string;
	username: string;
}

interface JobDoneEvent {
	type: "job:done";
	jobId: string;
	durationMs: number;
	success: boolean;
}

interface QueueDepthEvent {
	queueDepth: number;
}

/** Compact elapsed time: "5s", "2m 30s", "1h 4m". */
function formatElapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) {
		return `${s}s`;
	}
	const m = Math.floor(s / 60);
	const rem = s % 60;
	if (m < 60) {
		return `${m}m ${rem}s`;
	}
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
	const [, setTick] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 1000);
		return () => clearInterval(id);
	}, []);

	return (
		<span className="font-monospace text-body-secondary" style={{ fontSize: "0.9rem" }}>
			{formatElapsed(Date.now() - Date.parse(startedAt))}
		</span>
	);
}

function PingDot({ active }: { active: boolean }) {
	return (
		<div style={{ position: "relative", width: "0.55rem", height: "0.55rem", flexShrink: 0 }}>
			{active && (
				<span
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						backgroundColor: "var(--bs-success)",
						animation: "jq-dot-ping 1.6s ease-out infinite",
					}}
				/>
			)}
			<span
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: "50%",
					backgroundColor: active ? "var(--bs-success)" : "var(--bs-secondary-color)",
					transition: "background-color 0.3s",
				}}
			/>
		</div>
	);
}

const cardStyle = (active: boolean): React.CSSProperties => ({
	border: `1px solid ${active ? "var(--bs-success)" : "var(--bs-border-color)"}`,
	borderRadius: "0.5rem",
	padding: "0.6rem 0.75rem",
	transition: "border-color 0.4s, background-color 0.4s, opacity 0.4s, box-shadow 0.4s",
	opacity: active ? 1 : 0.72,
	backgroundColor: active ? "rgba(var(--bs-success-rgb), 0.1)" : "var(--bs-secondary-bg)",
	boxShadow: active ? "0 0 0 1px rgba(var(--bs-success-rgb), 0.2)" : "none",
	animation: active ? "jq-glow 2.5s ease-in-out infinite" : undefined,
	display: "flex",
	flexDirection: "column",
	gap: "0.35rem",
	textDecoration: "none",
	color: "inherit",
	cursor: active ? "pointer" : "default",
});

function SlotCard({ job, index }: { index: number; job: ActiveJob | null }) {
	const active = job !== null;
	const importTypeShort = job?.importType ?? "";
	const title = active ? `${job.importType} — job ${job.jobId}` : "Idle";

	const inner = (
		<>
			{/* Slot index + status dot */}
			<div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
				<PingDot active={active} />
				<span
					className={active ? "text-body fw-semibold" : "text-body-secondary"}
					style={{ fontSize: "0.85rem" }}
				>
					#{index + 1}
				</span>
			</div>

			{/* key swap forces re-mount → entry animation fires on each job start */}
			{active ? (
				<div
					key="active"
					style={{
						animation: "jq-content-in 0.3s ease",
						display: "flex",
						flexDirection: "column",
						gap: "0.35rem",
					}}
				>
					<div className="fw-semibold text-truncate" style={{ fontSize: "1rem" }}>
						{job.username ?? <span className="text-body-secondary">unknown</span>}
					</div>
					<Badge
						bg="success"
						className="font-monospace text-truncate d-block"
						style={{ fontSize: "0.8rem", maxWidth: "100%", opacity: 0.85 }}
					>
						{importTypeShort}
					</Badge>
					<ElapsedTimer startedAt={job.startedAt} />
				</div>
			) : (
				<span className="text-body-secondary" key="idle" style={{ fontSize: "0.95rem" }}>
					Idle
				</span>
			)}
		</>
	);

	if (active && job.username) {
		return (
			<Link style={cardStyle(true)} title={title} to={`/u/${job.username}`}>
				{inner}
			</Link>
		);
	}

	return (
		<div style={cardStyle(active)} title={title}>
			{inner}
		</div>
	);
}

/** Default slot count shown before the worker process advertises its pool size. */
const DEFAULT_SLOT_COUNT = 1;

export default function WorkerVisualizer({
	streamUrl = "/status/worker-stream",
}: {
	streamUrl?: string;
}) {
	const [jobs, setJobs] = useState<Map<string, ActiveJob>>(new Map());
	const [queueDepth, setQueueDepth] = useState(0);
	const [workerCount, setWorkerCount] = useState<number>(DEFAULT_SLOT_COUNT);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		const es = new EventSource(ToAPIURL(streamUrl), {
			withCredentials: true,
		});

		es.addEventListener("snapshot", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as SnapshotEvent;
			setJobs(new Map(data.activeJobs.map((j) => [j.jobId, j])));
			setQueueDepth(data.queueDepth);
			if (data.workerCount !== null && data.workerCount > 0) {
				setWorkerCount(data.workerCount);
			}
			setConnected(true);
		});

		es.addEventListener("job:start", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as JobStartEvent;
			setJobs((prev) => {
				const next = new Map(prev);
				next.set(data.jobId, {
					jobId: data.jobId,
					userId: data.userId,
					username: data.username,
					importType: data.importType,
					importId: data.importId,
					startedAt: new Date().toISOString(),
				});
				return next;
			});
			setQueueDepth((d) => Math.max(0, d - 1));
		});

		es.addEventListener("job:done", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as JobDoneEvent;
			setJobs((prev) => {
				const next = new Map(prev);
				next.delete(data.jobId);
				return next;
			});
		});

		es.addEventListener("queue:depth", (e: MessageEvent<string>) => {
			const data = JSON.parse(e.data) as QueueDepthEvent;
			setQueueDepth(data.queueDepth);
		});

		es.onerror = () => {
			setConnected(false);
		};

		return () => {
			es.close();
			setConnected(false);
		};
	}, [streamUrl]);

	// Fill slots left-to-right: active jobs first, remainder idle.
	const jobList = [...jobs.values()];
	const slots: Array<ActiveJob | null> = Array.from(
		{ length: Math.max(workerCount, jobList.length) },
		(_, i) => jobList[i] ?? null,
	);

	const activeCount = jobList.length;

	return (
		<section className="d-none d-md-block">
			<div className="d-flex align-items-center mb-3">
				<h2 className="h5 mb-0">Watch score imports live</h2>

				<div
					className="d-flex align-items-center gap-3 ms-auto"
					style={{ fontSize: "1rem" }}
				>
					<div
						style={{
							position: "relative",
							width: "0.55rem",
							height: "0.55rem",
							flexShrink: 0,
						}}
						title={connected ? "Connected" : "Connecting…"}
					>
						{connected && (
							<span
								style={{
									position: "absolute",
									inset: 0,
									borderRadius: "50%",
									backgroundColor: "var(--bs-success)",
									animation: "jq-dot-ping 2.5s ease-out infinite",
								}}
							/>
						)}
						<span
							className={`rounded-circle d-block ${connected ? "bg-success" : "bg-secondary"}`}
							style={{ width: "0.55rem", height: "0.55rem", position: "relative" }}
						/>
					</div>

					<span className="d-flex align-items-center gap-2">
						<Badge bg="primary" style={{ fontSize: "0.9rem" }}>
							{activeCount}
						</Badge>
						<span className="text-body-secondary">/ {workerCount} running</span>
					</span>

					<span className="d-flex align-items-center gap-2">
						<span className="text-body-secondary">Queue:</span>
						<Badge
							bg={queueDepth > 0 ? "warning" : "secondary"}
							style={
								queueDepth > 0
									? {
											animation: "jq-pulse 1.5s infinite",
											color: "var(--bs-dark)",
											fontSize: "0.9rem",
										}
									: { fontSize: "0.9rem" }
							}
						>
							{queueDepth} waiting
						</Badge>
					</span>
				</div>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
					gap: "0.625rem",
				}}
			>
				{slots.map((job, i) => (
					<SlotCard index={i} job={job} key={i} />
				))}
			</div>

			{/* hahahahaha */}
			<style>{`
				@keyframes jq-pulse {
					0%, 100% { opacity: 1; }
					50%       { opacity: 0.55; }
				}
				@keyframes jq-glow {
					0%, 100% { box-shadow: 0 0 4px 0   rgba(var(--bs-success-rgb), 0.15); }
					50%      { box-shadow: 0 0 14px 3px rgba(var(--bs-success-rgb), 0.35); }
				}
				@keyframes jq-dot-ping {
					0%   { transform: scale(1);   opacity: 0.75; }
					80%  { transform: scale(2.8); opacity: 0; }
					100% { transform: scale(2.8); opacity: 0; }
				}
				@keyframes jq-content-in {
					from { opacity: 0; transform: translateY(5px); }
					to   { opacity: 1; transform: translateY(0); }
				}
			`}</style>
		</section>
	);
}
