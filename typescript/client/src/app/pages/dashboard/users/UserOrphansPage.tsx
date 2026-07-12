import useSetSubheader from "#components/layout/header/useSetSubheader";
import TachiTable from "#components/tables/components/TachiTable";
import Loading from "#components/util/Loading";
import { APIFetchV1 } from "#util/api";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { type GameGroup, GetGameGroupConfig, type UserDocument } from "tachi-common";

type OrphanListItem = {
	gameGroup: string;
	importType: string;
	message: string | null;
	orphanID: string;
	rowID: string;
	summary: string | null;
	timeInserted: number;
};

type ListBody = { hasMore: boolean; orphans: OrphanListItem[] };

type ReprocessBody = {
	failed: number;
	processed: number;
	removed: number;
	success: number;
};

type OrphanDetailBody = {
	context: unknown;
	data: unknown;
	gameGroup: string;
	importType: string;
	message: string | null;
	orphanID: string;
	timeInserted: number;
};

export default function UserOrphansPage({ reqUser }: { reqUser: UserDocument }) {
	useSetSubheader(
		["Users", reqUser.username, "Orphan scores"],
		[reqUser],
		`${reqUser.username}'s Orphan scores`,
	);

	const [orphans, setOrphans] = useState<OrphanListItem[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [reprocessBusy, setReprocessBusy] = useState(false);
	const [lastMessage, setLastMessage] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailJson, setDetailJson] = useState<string | null>(null);
	const [detailTitle, setDetailTitle] = useState<string>("");

	const fetchPage = useCallback(async (afterRowID: string | undefined, append: boolean) => {
		const params = new URLSearchParams({ limit: "50" });
		if (afterRowID) {
			params.set("after", afterRowID);
		}
		const res = await APIFetchV1<ListBody>(`/import/orphans?${params.toString()}`);
		if (!res.success) {
			setLastMessage(res.description);
			if (!append) {
				setOrphans([]);
				setHasMore(false);
			}
			return;
		}
		setLastMessage(null);
		setHasMore(res.body.hasMore);
		if (append) {
			setOrphans((prev) => [...prev, ...res.body.orphans]);
		} else {
			setOrphans(res.body.orphans);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			setLoading(true);
			await fetchPage(undefined, false);
			if (!cancelled) {
				setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [fetchPage]);

	const onLoadMore = async () => {
		const last = orphans[orphans.length - 1];
		if (!last) {
			return;
		}
		setLoadingMore(true);
		await fetchPage(last.rowID, true);
		setLoadingMore(false);
	};

	const onReprocess = async () => {
		setReprocessBusy(true);
		setLastMessage(null);
		const res = await APIFetchV1<ReprocessBody>(
			"/import/orphans",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
			true,
			true,
		);
		setReprocessBusy(false);
		if (res.success) {
			const { processed, failed, removed, success } = res.body;
			setLastMessage(
				`Reprocessed ${processed}: ${success} converted, ${failed} still unmatched, ${removed} removed as invalid.`,
			);
			setLoading(true);
			await fetchPage(undefined, false);
			setLoading(false);
		}
	};

	const onOpenDetail = async (orphanID: string) => {
		setDetailTitle(orphanID);
		setDetailJson(null);
		setDetailOpen(true);
		setDetailLoading(true);
		const res = await APIFetchV1<OrphanDetailBody>(
			`/import/orphans/${encodeURIComponent(orphanID)}`,
			undefined,
			false,
			true,
		);
		setDetailLoading(false);
		if (!res.success) {
			setDetailJson(null);
			return;
		}
		const { data, context, ...meta } = res.body;
		setDetailJson(JSON.stringify({ ...meta, data, context }, null, 2));
	};

	const onDelete = async (orphanID: string) => {
		if (!window.confirm(`Delete orphan ${orphanID}? This cannot be undone.`)) {
			return;
		}
		const res = await APIFetchV1(
			`/import/orphans/${encodeURIComponent(orphanID)}`,
			{ method: "DELETE" },
			true,
			true,
		);
		if (!res.success) {
			return;
		}
		setOrphans((prev) => prev.filter((o) => o.orphanID !== orphanID));
	};

	return (
		<div className="vstack gap-4">
			<div>
				<h4>Orphan scores</h4>
				<p className="mb-2">
					When an import cannot match a song or chart (SongOrChartNotFound), Tachi still
					stores that datapoint as an <strong>orphan</strong>. Orphans are retried
					automatically around <strong>1 AM UTC</strong> each day, or you can run a full
					reprocess below.
				</p>
				<p className="mb-0">
					Deleting an orphan only removes that queued datapoint; it does not revert an
					entire import.
				</p>
			</div>

			<div className="d-flex flex-wrap gap-2 align-items-center">
				<Button
					disabled={reprocessBusy}
					onClick={() => void onReprocess()}
					variant="primary"
				>
					{reprocessBusy ? "Reprocessing…" : "Reprocess all my orphans now"}
				</Button>
			</div>

			{lastMessage && <Alert variant="info">{lastMessage}</Alert>}

			<Modal onHide={() => setDetailOpen(false)} show={detailOpen} size="lg">
				<Modal.Header closeButton>
					<Modal.Title>Orphan details - {detailTitle}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{detailLoading ? (
						<Loading />
					) : detailJson ? (
						<pre className="small mb-0" style={{ maxHeight: "70vh", overflow: "auto" }}>
							{detailJson}
						</pre>
					) : (
						<p className="text-muted mb-0">Could not load details.</p>
					)}
				</Modal.Body>
			</Modal>

			{loading ? (
				<Loading />
			) : orphans.length === 0 ? (
				<Alert variant="secondary">You have no orphan scores right now.</Alert>
			) : (
				<>
					<TachiTable
						dataset={orphans}
						entryName="Orphan scores"
						headers={[
							["Summary", "Summary"],
							["Import type", "Import type"],
							["Game", "Game"],
							["Time", "Time"],
							["Message", "Message"],
							["", "Actions"],
						]}
						rowFunction={(o) => (
							<tr key={o.orphanID}>
								<td>{o.summary ?? "-"}</td>
								<td>
									<code className="small">{o.importType}</code>
								</td>
								<td>
									{GetGameGroupConfig(o.gameGroup as GameGroup)?.name ??
										o.gameGroup}
								</td>
								<td>{new Date(o.timeInserted).toLocaleString()}</td>
								<td className="small text-muted">{o.message ?? "-"}</td>
								<td>
									<div className="d-flex flex-wrap gap-1">
										<Button
											onClick={() => void onOpenDetail(o.orphanID)}
											size="sm"
											variant="outline-secondary"
										>
											Details
										</Button>
										<Button
											onClick={() => void onDelete(o.orphanID)}
											size="sm"
											variant="outline-danger"
										>
											Delete
										</Button>
									</div>
								</td>
							</tr>
						)}
					/>
					{hasMore && (
						<Button
							disabled={loadingMore}
							onClick={() => void onLoadMore()}
							variant="outline-secondary"
						>
							{loadingMore ? "Loading…" : "Load more"}
						</Button>
					)}
				</>
			)}
		</div>
	);
}
