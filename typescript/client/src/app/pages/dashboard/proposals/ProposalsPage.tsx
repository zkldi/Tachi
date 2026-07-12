/**
 * ProposalsPage — public listing of all open quest proposals.
 */

import type { UnsuccessfulAPIResponse } from "tachi-common";

import useSetSubheader from "#components/layout/header/useSetSubheader";
import LoadingWrapper from "#components/util/LoadingWrapper";
import { TachiConfig } from "#lib/config";
import { APIFetchV1 } from "#util/api";
import React, { useEffect, useState } from "react";
import { Badge, Card, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

type ProposalSummary = {
	createdAt: string;
	prNumber: number;
	proposalID: string;
	prUrl: string;
	quests: Array<{ game: string; name: string }>;
	status: string;
	submitterUsername: string;
};

type ProposalsResponse = {
	page: number;
	proposals: Array<ProposalSummary>;
};

function statusBadge(status: string) {
	switch (status) {
		case "open":
			return <Badge bg="success">Open</Badge>;
		case "merged":
			return <Badge bg="primary">Merged</Badge>;
		case "closed":
			return <Badge bg="secondary">Closed</Badge>;
		default:
			return <Badge bg="secondary">{status}</Badge>;
	}
}

export default function ProposalsPage() {
	useSetSubheader(["Community", "Quest Proposals"]);

	const [data, setData] = useState<ProposalsResponse | null>(null);
	const [error, setError] = useState<UnsuccessfulAPIResponse | null>(null);
	const [page, setPage] = useState(0);

	useEffect(() => {
		setData(null);
		setError(null);

		APIFetchV1<ProposalsResponse>(`/proposals?page=${page}`).then((res) => {
			if (!res.success) {
				setError(res);
				return;
			}

			setData(res.body);
		});
	}, [page]);

	return (
		<>
			<h2 className="mb-1">Community Quest Proposals</h2>
			<p className="text-body-secondary small mb-3">
				Quest proposals submitted by the community for review.
				{TachiConfig.QUEST_PROPOSALS_ENABLED ? (
					<>
						{" "}
						Open a PR to add your own quests via the{" "}
						<Link to="/quests">Quest Editor</Link>.
					</>
				) : (
					<> Open a PR on the seeds repository to add your own quests.</>
				)}
			</p>

			<LoadingWrapper dataset={data} error={error}>
				<>
					{data?.proposals.length === 0 && page === 0 ? (
						<p className="text-body-secondary">No open proposals yet. Be the first!</p>
					) : (
						<Row className="g-3">
							{data?.proposals.map((p) => (
								<Col key={p.proposalID} lg={4} md={6} xs={12}>
									<ProposalCard proposal={p} />
								</Col>
							))}
						</Row>
					)}

					<div className="d-flex gap-2 mt-4">
						{page > 0 && (
							<button
								className="btn btn-outline-secondary btn-sm"
								onClick={() => setPage((prev) => prev - 1)}
								type="button"
							>
								← Previous
							</button>
						)}
						{data && data.proposals.length === 20 && (
							<button
								className="btn btn-outline-secondary btn-sm"
								onClick={() => setPage((prev) => prev + 1)}
								type="button"
							>
								Next →
							</button>
						)}
					</div>
				</>
			</LoadingWrapper>
		</>
	);
}

function ProposalCard({ proposal }: { proposal: ProposalSummary }) {
	return (
		<Card className="h-100">
			<Card.Body>
				<div className="d-flex align-items-center justify-content-between mb-2">
					<span className="text-body-secondary small">PR #{proposal.prNumber}</span>
					{statusBadge(proposal.status)}
				</div>

				<h6 className="mb-1">{proposal.quests.map((q) => q.name).join(", ")}</h6>

				<p className="text-body-secondary small mb-2">
					{proposal.quests.map((q) => q.game).join(", ")}
				</p>

				<p className="text-body-secondary small mb-3">
					Submitted by{" "}
					<Link to={`/u/${proposal.submitterUsername}`}>
						{proposal.submitterUsername}
					</Link>{" "}
					on {new Date(proposal.createdAt).toLocaleDateString()}
				</p>

				<a
					className="btn btn-outline-primary btn-sm"
					href={proposal.prUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					View PR on GitHub
				</a>
			</Card.Body>
		</Card>
	);
}
