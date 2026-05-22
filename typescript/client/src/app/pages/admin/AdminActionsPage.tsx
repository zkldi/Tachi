import useSetSubheader from "#components/layout/header/useSetSubheader";
import useApiQuery from "#components/util/query/useApiQuery";
import { ADMIN_RECENT_HOURS } from "#lib/adminConstants";
import { MillisToSince } from "#util/time";
import React from "react";
import { Badge, Button, Form, Table } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";

type ActionRow = {
	app: string;
	input: unknown;
	ip: string | null;
	kind: string;
	output: unknown | null;
	result: "BAD" | "GOOD" | "THROW";
	row_id: string;
	ts_end: string;
	ts_start: string;
	user_id: number | null;
	username: string | null;
};

type ActionsResponse = {
	actions: {
		items: ActionRow[];
		page: number;
		pageSize: number;
		total: number;
	};
	filters: { kind?: string; username?: string };
};

function durationMs(start: string, end: string): string {
	const ms = Date.parse(end) - Date.parse(start);
	if (Number.isNaN(ms)) {
		return "-";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

function resultVariant(result: string): "danger" | "secondary" | "success" | "warning" {
	if (result === "GOOD") {
		return "success";
	}
	if (result === "BAD") {
		return "warning";
	}
	if (result === "THROW") {
		return "danger";
	}
	return "secondary";
}

function formatJson(value: unknown): string {
	if (value === undefined) {
		return "";
	}
	return JSON.stringify(value, null, 2);
}

export default function AdminActionsPage() {
	useSetSubheader(["Admin", "Actions"]);
	const location = useLocation();
	const history = useHistory();
	const apiUrl = `/admin/actions${location.search}`;

	const [expandedIds, setExpandedIds] = React.useState(() => new Set<string>());

	const { data, error, isLoading } = useApiQuery<ActionsResponse>(apiUrl);

	function toggleIoExpanded(rowId: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(rowId)) {
				next.delete(rowId);
			} else {
				next.add(rowId);
			}
			return next;
		});
	}

	if (error) {
		return <p className="text-danger">Failed to load actions.</p>;
	}

	if (isLoading || !data) {
		return <p className="text-body-secondary">Loading…</p>;
	}

	const { actions, filters } = data;
	const pageSize = actions.pageSize;
	const totalPages = Math.ceil(actions.total / pageSize);
	const currentPage = actions.page;

	function buildPageUrl(p: number) {
		const sp = new URLSearchParams(location.search);
		sp.set("page", String(p));
		return `/admin/actions?${sp.toString()}`;
	}

	function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const sp = new URLSearchParams();
		sp.set("page", "0");
		const kind = fd.get("kind");
		if (typeof kind === "string" && kind.trim() !== "") {
			sp.set("kind", kind.trim());
		}
		const username = fd.get("username");
		if (typeof username === "string" && username.trim() !== "") {
			sp.set("username", username.trim());
		}
		history.push(`/admin/actions?${sp.toString()}`);
	}

	return (
		<div className="d-flex flex-column gap-3">
			<h2 className="h5">
				Actions <span className="badge bg-secondary">{actions.total.toLocaleString()}</span>
			</h2>
			<p className="small text-body-secondary mb-0">
				Actions from the last {ADMIN_RECENT_HOURS} hours (up to {pageSize} per page).
			</p>

			<Form className="d-flex flex-wrap align-items-end gap-3" onSubmit={onFilterSubmit}>
				<Form.Group>
					<Form.Label className="small mb-0">Action kind</Form.Label>
					<Form.Control
						defaultValue={filters.kind ?? ""}
						name="kind"
						placeholder="e.g. SET_USER_SUPPORTER_STATUS"
						size="sm"
						type="text"
					/>
				</Form.Group>
				<Form.Group>
					<Form.Label className="small mb-0">Username</Form.Label>
					<Form.Control
						defaultValue={filters.username ?? ""}
						name="username"
						placeholder="Filter by username"
						size="sm"
						type="text"
					/>
				</Form.Group>
				<Button size="sm" type="submit" variant="primary">
					Filter
				</Button>
				<Link className="btn btn-sm btn-outline-secondary" to="/admin/actions">
					Clear
				</Link>
			</Form>

			<div className="table-responsive">
				<Table hover size="sm" striped>
					<thead>
						<tr>
							<th>Time</th>
							<th>Duration</th>
							<th>Kind</th>
							<th>Result</th>
							<th>User</th>
							<th>IP</th>
							<th className="text-nowrap">Input / output</th>
						</tr>
					</thead>
					<tbody>
						{actions.items.length === 0 ? (
							<tr>
								<td className="text-body-secondary" colSpan={7}>
									No actions found.
								</td>
							</tr>
						) : (
							actions.items.map((action) => {
								const ioOpen = expandedIds.has(action.row_id);
								return (
									<React.Fragment key={action.row_id}>
										<tr>
											<td className="small text-nowrap">
												{MillisToSince(Date.parse(action.ts_start))}
											</td>
											<td className="font-monospace small">
												{durationMs(action.ts_start, action.ts_end)}
											</td>
											<td className="small">{action.kind}</td>
											<td>
												<Badge bg={resultVariant(action.result)}>
													{action.result}
												</Badge>
											</td>
											<td>
												{action.username ? (
													<Link to={`/u/${action.username}`}>
														{action.username}
													</Link>
												) : (
													<span className="text-body-secondary">-</span>
												)}
											</td>
											<td className="font-monospace small">
												{action.ip ?? "-"}
											</td>
											<td className="align-middle">
												<Button
													aria-expanded={ioOpen}
													className="text-nowrap"
													onClick={() => toggleIoExpanded(action.row_id)}
													size="sm"
													type="button"
													variant="outline-secondary"
												>
													{ioOpen ? "Hide I/O" : "Show I/O"}
												</Button>
											</td>
										</tr>
										{ioOpen && (
											<tr className="table-light">
												<td className="border-top-0 p-3" colSpan={7}>
													<div className="d-flex flex-column flex-lg-row gap-3 align-items-stretch">
														<div className="flex-fill d-flex flex-column min-w-0">
															<Form.Label className="small mb-1 text-body-secondary">
																Input
															</Form.Label>
															<Form.Control
																as="textarea"
																className="font-monospace small"
																readOnly
																rows={14}
																spellCheck={false}
																value={formatJson(action.input)}
															/>
														</div>
														<div
															aria-hidden
															className="d-flex align-items-center justify-content-center px-1 text-body-secondary fs-4"
														>
															→
														</div>
														<div className="flex-fill d-flex flex-column min-w-0">
															<Form.Label className="small mb-1 text-body-secondary">
																Output
															</Form.Label>
															<Form.Control
																as="textarea"
																className="font-monospace small"
																readOnly
																rows={14}
																spellCheck={false}
																value={formatJson(action.output)}
															/>
														</div>
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								);
							})
						)}
					</tbody>
				</Table>
			</div>

			{totalPages > 1 && (
				<div className="d-flex align-items-center gap-3">
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
		</div>
	);
}
