/**
 * MyProposalsPage — shows the logged-in user's own quest proposals,
 * with edit and withdraw capabilities.
 */

import type { UnsuccessfulAPIResponse, UserDocument } from "tachi-common";

import useSetSubheader from "#components/layout/header/useSetSubheader";
import LoadingWrapper from "#components/util/LoadingWrapper";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import { APIFetchV1 } from "#util/api";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Modal, Row } from "react-bootstrap";
import { Link, Redirect } from "react-router-dom";

type MyProposal = {
	createdAt: string;
	prNumber: number;
	proposalID: string;
	prUrl: string;
	rawQuestlines: unknown;
	rawQuests: unknown;
	status: string;
	updatedAt: string;
};

type MyProposalsResponse = {
	proposals: Array<MyProposal>;
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

export default function MyProposalsPage() {
	useSetSubheader(["My Quest Proposals"]);

	const { user } = useContext(UserContext);

	if (!user) {
		return <Redirect to="/login" />;
	}

	return <MyProposalsPageInner user={user} />;
}

function MyProposalsPageInner({ user: _user }: { user: UserDocument }) {
	const [data, setData] = useState<MyProposalsResponse | null>(null);
	const [error, setError] = useState<UnsuccessfulAPIResponse | null>(null);

	const reload = useCallback(() => {
		setData(null);
		setError(null);

		APIFetchV1<MyProposalsResponse>("/proposals/mine").then((res) => {
			if (!res.success) {
				setError(res);
				return;
			}

			setData(res.body);
		});
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	return (
		<>
			<div className="d-flex align-items-center justify-content-between mb-3">
				<h2 className="mb-0">My Quest Proposals</h2>
				{TachiConfig.QUEST_PROPOSALS_ENABLED && (
					<Link className="btn btn-outline-success btn-sm" to="/quests">
						+ New Proposal
					</Link>
				)}
			</div>

			<LoadingWrapper dataset={data} error={error}>
				<>
					{data?.proposals.length === 0 ? (
						<p className="text-body-secondary">
							You haven&apos;t submitted any proposals yet.
							{TachiConfig.QUEST_PROPOSALS_ENABLED && (
								<>
									{" "}
									<Link to="/quests">Create one in the Quest Editor!</Link>
								</>
							)}
						</p>
					) : (
						<Row className="g-3">
							{data?.proposals.map((proposal) => (
								<Col key={proposal.proposalID} lg={6} xs={12}>
									<MyProposalCard onWithdrawn={reload} proposal={proposal} />
								</Col>
							))}
						</Row>
					)}
				</>
			</LoadingWrapper>
		</>
	);
}

function MyProposalCard({
	proposal,
	onWithdrawn,
}: {
	onWithdrawn: () => void;
	proposal: MyProposal;
}) {
	const [withdrawing, setWithdrawing] = useState(false);
	const [withdrawErr, setWithdrawErr] = useState<string | null>(null);
	const [showConfirm, setShowConfirm] = useState(false);

	const questNames = Array.isArray(proposal.rawQuests)
		? (proposal.rawQuests as Array<{ name: string }>).map((q) => q.name).join(", ")
		: "Quest Proposal";

	const handleWithdraw = async () => {
		setWithdrawErr(null);
		setWithdrawing(true);

		try {
			const res = await APIFetchV1(`/proposals/${proposal.proposalID}`, {
				method: "DELETE",
			});

			if (!res.success) {
				setWithdrawErr(res.description);
				return;
			}

			setShowConfirm(false);
			onWithdrawn();
		} catch (e) {
			setWithdrawErr((e as Error).message);
		} finally {
			setWithdrawing(false);
		}
	};

	return (
		<>
			<Card className="h-100">
				<Card.Body>
					<div className="d-flex align-items-center justify-content-between mb-2">
						<span className="text-body-secondary small">PR #{proposal.prNumber}</span>
						{statusBadge(proposal.status)}
					</div>

					<h6 className="mb-1">{questNames}</h6>

					<p className="text-body-secondary small mb-2">
						Submitted {new Date(proposal.createdAt).toLocaleDateString()}
						{proposal.updatedAt !== proposal.createdAt && (
							<>
								{" · "}Updated {new Date(proposal.updatedAt).toLocaleDateString()}
							</>
						)}
					</p>

					<div className="d-flex gap-2 flex-wrap">
						<a
							className="btn btn-outline-primary btn-sm"
							href={proposal.prUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							View on GitHub
						</a>

						{proposal.status === "open" && (
							<Button
								onClick={() => setShowConfirm(true)}
								size="sm"
								variant="outline-danger"
							>
								Withdraw
							</Button>
						)}
					</div>
				</Card.Body>
			</Card>

			<Modal onHide={() => setShowConfirm(false)} show={showConfirm}>
				<Modal.Header closeButton>
					<Modal.Title>Withdraw Proposal?</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p>
						This will close PR #{proposal.prNumber} and mark the proposal as withdrawn.
						This cannot be undone.
					</p>
					{withdrawErr && <Alert variant="danger">{withdrawErr}</Alert>}
				</Modal.Body>
				<Modal.Footer>
					<Button
						disabled={withdrawing}
						onClick={() => setShowConfirm(false)}
						variant="secondary"
					>
						Cancel
					</Button>
					<Button disabled={withdrawing} onClick={handleWithdraw} variant="danger">
						{withdrawing ? "Withdrawing…" : "Withdraw"}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
}
