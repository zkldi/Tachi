import useSetSubheader from "#components/layout/header/useSetSubheader";
import useApiQuery from "#components/util/query/useApiQuery";
import { MillisToSince } from "#util/time";
import React, { useMemo } from "react";
import { Badge, Table } from "react-bootstrap";

type CronTask = {
	created_at: string;
	description: string | null;
	id: string;
	last_scheduled_at: string | null;
	schedule: string;
	updated_at: string;
};

type CronTaskExecution = {
	completed_at: string | null;
	error: string | null;
	id: number;
	output: string | null;
	scheduled_at: string;
	started_at: string;
	status: string;
	task_id: string;
};

type CronResponse = {
	executions: CronTaskExecution[];
	tasks: CronTask[];
};

function durationMs(startedAt: string, completedAt: string | null): string {
	if (!completedAt) {
		return "-";
	}
	const ms = Date.parse(completedAt) - Date.parse(startedAt);
	if (Number.isNaN(ms)) {
		return "-";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

function execStatusVariant(status: string): "danger" | "primary" | "secondary" | "success" {
	if (status === "running") {
		return "primary";
	}
	if (status === "success") {
		return "success";
	}
	if (status === "failure") {
		return "danger";
	}
	return "secondary";
}

export default function AdminCronJobsPage() {
	useSetSubheader(["Admin", "Cron jobs"]);

	const { data, error, isLoading } = useApiQuery<CronResponse>("/admin/cron-tasks");

	const executionsByTask = useMemo(() => {
		if (!data) {
			return new Map<string, CronTaskExecution[]>();
		}
		const map = new Map<string, CronTaskExecution[]>();
		for (const exec of data.executions) {
			const list = map.get(exec.task_id) ?? [];
			list.push(exec);
			map.set(exec.task_id, list);
		}
		return map;
	}, [data]);

	if (error) {
		return <p className="text-danger">Failed to load cron tasks.</p>;
	}

	if (isLoading || !data) {
		return <p className="text-body-secondary">Loading…</p>;
	}

	const { tasks } = data;

	if (tasks.length === 0) {
		return <p className="text-body-secondary">No cron tasks configured.</p>;
	}

	return (
		<div className="d-flex flex-column gap-5">
			{tasks.map((task) => {
				const execs = executionsByTask.get(task.id) ?? [];
				return (
					<section key={task.id}>
						<div className="mb-2">
							<code className="me-2">{task.id}</code>
							<code className="text-body-secondary">{task.schedule}</code>
							{task.description && (
								<p className="small mb-1 mt-1">{task.description}</p>
							)}
							<div className="small text-body-secondary d-flex flex-wrap gap-3">
								<span>
									Last scheduled:{" "}
									{task.last_scheduled_at
										? MillisToSince(Date.parse(task.last_scheduled_at))
										: "Never"}
								</span>
								<span>Created: {MillisToSince(Date.parse(task.created_at))}</span>
							</div>
						</div>

						<h3 className="h6">
							Recent executions{" "}
							<span className="badge bg-secondary">{execs.length}</span>
						</h3>
						{execs.length === 0 ? (
							<p className="small text-body-secondary">No executions yet.</p>
						) : (
							<div className="table-responsive">
								<Table hover size="sm" striped>
									<thead>
										<tr>
											<th>Scheduled</th>
											<th>Started</th>
											<th>Completed</th>
											<th>Duration</th>
											<th>Status</th>
											<th>Output / error</th>
										</tr>
									</thead>
									<tbody>
										{execs.map((exec) => (
											<tr key={exec.id}>
												<td className="small">
													{MillisToSince(Date.parse(exec.scheduled_at))}
												</td>
												<td className="small">
													{MillisToSince(Date.parse(exec.started_at))}
												</td>
												<td className="small">
													{exec.completed_at ? (
														MillisToSince(Date.parse(exec.completed_at))
													) : (
														<span className="text-warning">
															In progress
														</span>
													)}
												</td>
												<td className="font-monospace small">
													{durationMs(exec.started_at, exec.completed_at)}
												</td>
												<td>
													<Badge bg={execStatusVariant(exec.status)}>
														{exec.status}
													</Badge>
												</td>
												<td className="small">
													{exec.error ? (
														<details>
															<summary className="text-danger">
																Error
															</summary>
															<pre className="small mb-0 mt-1 p-2 bg-danger bg-opacity-10 rounded">
																{exec.error}
															</pre>
														</details>
													) : exec.output ? (
														<details>
															<summary>Output</summary>
															<pre className="small mb-0 mt-1 p-2 bg-body-secondary rounded">
																{exec.output}
															</pre>
														</details>
													) : (
														<span className="text-body-secondary">
															-
														</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</Table>
							</div>
						)}
					</section>
				);
			})}
		</div>
	);
}
