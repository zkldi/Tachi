import useSetSubheader from "#components/layout/header/useSetSubheader";
import useApiQuery from "#components/util/query/useApiQuery";
import { ADMIN_PAGE_SIZE, ADMIN_RECENT_HOURS, JOB_STATUS } from "#lib/adminConstants";
import { MillisToSince } from "#util/time";
import React from "react";
import { Button, Form, Table } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";

type JobQueueRow = {
	created_at: string;
	failed_attempts: number;
	job_kind: string;
	payload: unknown;
	row_id: string;
	scheduled_for: string;
	scope: string;
	status: number;
	updated_at: string;
};

type JobQueueResponse = {
	activeJobs: JobQueueRow[];
	filters: { job_kind?: string; scope?: string; status?: number };
	jobQueue: {
		items: JobQueueRow[];
		page: number;
		pageSize: number;
		total: number;
	};
};

function statusLabel(status: number): string {
	return JOB_STATUS[status] ?? `Unknown (${status})`;
}

function PayloadCell({ payload }: { payload: unknown }) {
	const json = JSON.stringify(payload, null, 2);
	return (
		<details>
			<summary className="small text-body-secondary">View payload</summary>
			<pre
				className="small mb-0 mt-1 p-2 bg-body-secondary rounded"
				style={{ maxWidth: "28rem" }}
			>
				{json}
			</pre>
		</details>
	);
}

function JobRow({ job }: { job: JobQueueRow }) {
	return (
		<tr>
			<td className="font-monospace small">{job.row_id.slice(0, 8)}…</td>
			<td className="small text-nowrap">{MillisToSince(Date.parse(job.created_at))}</td>
			<td className="small text-nowrap">{MillisToSince(Date.parse(job.scheduled_for))}</td>
			<td>
				<span className="badge bg-secondary">{statusLabel(job.status)}</span>
			</td>
			<td className="font-monospace small">{job.scope}</td>
			<td className="font-monospace small">{job.job_kind}</td>
			<td className="text-center">{job.failed_attempts}</td>
			<td>
				<PayloadCell payload={job.payload} />
			</td>
		</tr>
	);
}

export default function AdminJobQueuePage() {
	useSetSubheader(["Admin", "Job queue"]);
	const location = useLocation();
	const history = useHistory();
	const apiUrl = `/admin/job-queue${location.search}`;

	const { data, error, isLoading } = useApiQuery<JobQueueResponse>(apiUrl);

	if (error) {
		return <p className="text-danger">Failed to load job queue.</p>;
	}

	if (isLoading || !data) {
		return <p className="text-body-secondary">Loading…</p>;
	}

	const { activeJobs, filters, jobQueue } = data;
	const pageSize = jobQueue.pageSize;
	const totalPages = Math.ceil(jobQueue.total / pageSize);
	const currentPage = jobQueue.page;
	const activeJobsTruncated = activeJobs.length >= ADMIN_PAGE_SIZE;

	function buildPageUrl(p: number) {
		const sp = new URLSearchParams(location.search);
		sp.set("page", String(p));
		return `/admin/job-queue?${sp.toString()}`;
	}

	function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const sp = new URLSearchParams();
		sp.set("page", "0");
		const status = fd.get("status");
		if (typeof status === "string" && status !== "") {
			sp.set("status", status);
		}
		const jk = fd.get("job_kind");
		if (typeof jk === "string" && jk.trim() !== "") {
			sp.set("job_kind", jk.trim());
		}
		const sc = fd.get("scope");
		if (typeof sc === "string" && sc.trim() !== "") {
			sp.set("scope", sc.trim());
		}
		history.push(`/admin/job-queue?${sp.toString()}`);
	}

	return (
		<div className="d-flex flex-column gap-4">
			{activeJobs.length > 0 && (
				<section>
					<h2 className="h5">
						Active jobs <span className="badge bg-primary">{activeJobs.length}</span>
					</h2>
					{activeJobsTruncated && (
						<p className="small text-body-secondary mb-2">
							Showing the first {ADMIN_PAGE_SIZE} running jobs (oldest scheduled
							first).
						</p>
					)}
					<div className="table-responsive">
						<Table hover size="sm" striped>
							<thead>
								<tr>
									<th>ID</th>
									<th>Created</th>
									<th>Scheduled for</th>
									<th>Status</th>
									<th>Scope</th>
									<th>Kind</th>
									<th>Failures</th>
									<th>Payload</th>
								</tr>
							</thead>
							<tbody>
								{activeJobs.map((job) => (
									<JobRow job={job} key={job.row_id} />
								))}
							</tbody>
						</Table>
					</div>
				</section>
			)}

			<section>
				<h2 className="h5">
					Recent jobs{" "}
					<span className="badge bg-secondary">{jobQueue.total.toLocaleString()}</span>
				</h2>
				<p className="small text-body-secondary mb-3">
					Jobs created in the last {ADMIN_RECENT_HOURS} hours (up to {pageSize} per page).
				</p>

				<Form
					className="d-flex flex-wrap align-items-end gap-3 mb-3"
					onSubmit={onFilterSubmit}
				>
					<Form.Group>
						<Form.Label className="small mb-0">Status</Form.Label>
						<Form.Select
							defaultValue={filters.status ?? ""}
							name="status"
							size="sm"
							style={{ minWidth: "8rem" }}
						>
							<option value="">All</option>
							{Object.entries(JOB_STATUS).map(([val, label]) => (
								<option key={val} value={val}>
									{label}
								</option>
							))}
						</Form.Select>
					</Form.Group>
					<Form.Group>
						<Form.Label className="small mb-0">Job kind</Form.Label>
						<Form.Control
							defaultValue={filters.job_kind ?? ""}
							name="job_kind"
							placeholder="e.g. process_score"
							size="sm"
							type="text"
						/>
					</Form.Group>
					<Form.Group>
						<Form.Label className="small mb-0">Scope</Form.Label>
						<Form.Control
							defaultValue={filters.scope ?? ""}
							name="scope"
							placeholder="e.g. score"
							size="sm"
							type="text"
						/>
					</Form.Group>
					<Button size="sm" type="submit" variant="primary">
						Filter
					</Button>
					<Link className="btn btn-sm btn-outline-secondary" to="/admin/job-queue">
						Clear
					</Link>
				</Form>

				<div className="table-responsive">
					<Table hover size="sm" striped>
						<thead>
							<tr>
								<th>ID</th>
								<th>Created</th>
								<th>Scheduled for</th>
								<th>Status</th>
								<th>Scope</th>
								<th>Kind</th>
								<th>Failures</th>
								<th>Payload</th>
							</tr>
						</thead>
						<tbody>
							{jobQueue.items.length === 0 ? (
								<tr>
									<td className="text-body-secondary" colSpan={8}>
										No jobs found.
									</td>
								</tr>
							) : (
								jobQueue.items.map((job) => <JobRow job={job} key={job.row_id} />)
							)}
						</tbody>
					</Table>
				</div>

				{totalPages > 1 && (
					<div className="d-flex align-items-center gap-3 mt-2">
						{currentPage > 0 && (
							<Link
								className="btn btn-sm btn-outline-primary"
								to={buildPageUrl(currentPage - 1)}
							>
								← Prev
							</Link>
						)}
						<span className="small text-body-secondary">
							Page {currentPage + 1} of {totalPages}
						</span>
						{currentPage < totalPages - 1 && (
							<Link
								className="btn btn-sm btn-outline-primary"
								to={buildPageUrl(currentPage + 1)}
							>
								Next →
							</Link>
						)}
					</div>
				)}
			</section>
		</div>
	);
}
