/**
 * Quest & Questline Editor
 *
 * Three-panel layout:
 *   Left  — Quest list + "New Quest" inline form
 *   Centre — Selected quest editor (EditableQuest)
 *   Right  — Questline composer
 *
 * Everything is saved to localStorage under LOCAL_QUEST_KEY / LOCAL_QUESTLINE_KEY.
 * Export produces separate quests.json and questlines.json files.
 */

import useSetSubheader from "#components/layout/header/useSetSubheader";
import EditableQuest from "#components/targets/quests/editor/EditableQuest";
import Divider from "#components/util/Divider";
import EditableText from "#components/util/EditableText";
import Icon from "#components/util/Icon";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import { type RawQuestDocument, type RawQuestlineDocument } from "#types/tachi";
import { APIFetchV1 } from "#util/api";
import { ChangeAtPosition, DeleteInPosition } from "#util/misc";
import { p, type PrudenceSchema } from "prudence";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import {
	ALL_GAMES,
	FormatGame,
	FormatPrError,
	type GameGroup,
	GetGameGroupConfig,
	LEGACY_GameGroupPTToGame,
	type LEGACY_GPTString,
	type LEGACY_Playtype,
	type V3Game,
} from "tachi-common";

// ─── localStorage keys ────────────────────────────────────────────────────────

const LOCAL_QUEST_KEY = "LOCAL_QUESTS";
const LOCAL_QUESTLINE_KEY = "LOCAL_QUESTLINES";

// ─── Validation schemas ───────────────────────────────────────────────────────

const PR_LOCAL_QUESTS_SCHEMA: PrudenceSchema = {
	json: [
		{
			/** V3 game id (e.g. `iidx-sp`), matching {@link RawQuestDocument}. */
			game: p.isIn(ALL_GAMES),
			name: "string",
			desc: "string",
			rawQuestData: [
				{
					title: "string",
					desc: p.optional("string"),
					rawGoals: [
						{
							goal: {
								name: "string",
								charts: p.or(
									{ type: p.is("folder"), data: "string" },
									{ type: p.is("multi"), data: ["string"] },
									{ type: p.is("single"), data: "string" },
								),
								criteria: p.or(
									{ mode: p.is("single"), key: "string", value: "number" },
									{
										mode: p.isIn("absolute", "proportion"),
										countNum: p.isPositive,
										key: "string",
										value: "number",
									},
								),
							},
							note: p.optional("string"),
						},
					],
				},
			],
		},
	],
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadLocalQuests(): Array<RawQuestDocument> {
	try {
		const data = window.localStorage.getItem(LOCAL_QUEST_KEY);

		if (!data) {
			return [];
		}

		const json = JSON.parse(data);
		const err = p({ json }, PR_LOCAL_QUESTS_SCHEMA);

		if (err) {
			if (
				confirm(
					`Failed to validate local quests: ${FormatPrError(err)}. Delete all and start again?`,
				)
			) {
				return [];
			}
		}

		return json as RawQuestDocument[];
	} catch {
		return [];
	}
}

function loadLocalQuestlines(): Array<RawQuestlineDocument> {
	try {
		const data = window.localStorage.getItem(LOCAL_QUESTLINE_KEY);

		if (!data) {
			return [];
		}

		return JSON.parse(data) as RawQuestlineDocument[];
	} catch {
		return [];
	}
}

function downloadJson(data: unknown, filename: string) {
	const href = `data:application/json;charset=UTF-8,${encodeURIComponent(JSON.stringify(data, null, "\t"))}`;
	const a = document.createElement("a");
	a.href = href;
	a.download = filename;
	a.click();
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Proposal types (mirrors server API response) ────────────────────────────

type MyProposal = {
	createdAt: string;
	prNumber: number;
	proposalID: string;
	prUrl: string;
	rawQuestlines: Array<RawQuestlineDocument>;
	rawQuests: Array<RawQuestDocument>;
	status: string;
	updatedAt: string;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuestEditor() {
	useSetSubheader(["Quest Editor"]);

	const { user } = useContext(UserContext);

	const initQuests = useMemo(() => loadLocalQuests(), []);
	const initQuestlines = useMemo(() => loadLocalQuestlines(), []);

	const [quests, setQuests] = useState<Array<RawQuestDocument>>(initQuests);
	const [questlines, setQuestlines] = useState<Array<RawQuestlineDocument>>(initQuestlines);
	const [selectedQuestIdx, setSelectedQuestIdx] = useState<number | null>(null);

	const [showImportQuests, setShowImportQuests] = useState(false);
	const [showImportQuestlines, setShowImportQuestlines] = useState(false);
	const [showSubmitModal, setShowSubmitModal] = useState(false);

	// When non-null, we're updating an existing proposal rather than creating one
	const [editingProposal, setEditingProposal] = useState<MyProposal | null>(null);

	// My proposals list
	const [proposals, setProposals] = useState<Array<MyProposal> | null>(null);
	const [proposalsLoading, setProposalsLoading] = useState(false);

	// ── Fetch my proposals ─────────────────────────────────────────────────────
	const fetchProposals = useCallback(() => {
		if (!user) {
			return;
		}

		setProposalsLoading(true);

		APIFetchV1<{ proposals: Array<MyProposal> }>("/proposals/mine").then((res) => {
			setProposalsLoading(false);

			if (res.success) {
				setProposals(res.body.proposals);
			}
		});
	}, [user]);

	useEffect(() => {
		fetchProposals();
	}, [fetchProposals]);

	// ── Persist to localStorage on every change ────────────────────────────────
	useEffect(() => {
		window.localStorage.setItem(LOCAL_QUEST_KEY, JSON.stringify(quests));
	}, [quests]);

	useEffect(() => {
		window.localStorage.setItem(LOCAL_QUESTLINE_KEY, JSON.stringify(questlines));
	}, [questlines]);

	// ── Derived ────────────────────────────────────────────────────────────────
	const selectedQuest = selectedQuestIdx !== null ? (quests[selectedQuestIdx] ?? null) : null;

	const addQuest = (gptString: LEGACY_GPTString) => {
		const [game, playtype] = gptString.split(":") as [GameGroup, LEGACY_Playtype];
		const v3Game: V3Game = LEGACY_GameGroupPTToGame(game, playtype);

		const newQuest: RawQuestDocument = {
			game: v3Game,
			name: "Untitled Quest",
			desc: "Please set a description.",
			rawQuestData: [],
		};

		setQuests((prev) => {
			const updated = [...prev, newQuest];
			setSelectedQuestIdx(updated.length - 1);
			return updated;
		});
	};

	const loadProposalIntoEditor = (proposal: MyProposal) => {
		if (quests.length > 0 || questlines.length > 0) {
			if (
				!confirm(
					"This will replace your current editor contents with the proposal's quests. Continue?",
				)
			) {
				return;
			}
		}

		setQuests(proposal.rawQuests);
		setQuestlines(proposal.rawQuestlines);
		setSelectedQuestIdx(null);
		setEditingProposal(proposal);
	};

	const clearEditingProposal = () => {
		setEditingProposal(null);
	};

	const handleAfterSubmit = () => {
		setEditingProposal(null);
		fetchProposals();
	};

	return (
		<Row className="g-3">
			<Col xs={12}>
				<div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
					<div>
						<h2 className="mb-1">Quest &amp; Questline Editor</h2>
						<p className="text-body-secondary small mb-0">
							Build quests locally and submit them to the community.
						</p>
					</div>
					{user &&
						quests.length > 0 &&
						(user.canSubmitQuests ? (
							<Button onClick={() => setShowSubmitModal(true)} variant="success">
								<Icon type="code-branch" />{" "}
								{editingProposal
									? `Update PR #${editingProposal.prNumber}`
									: "Submit to Community"}
							</Button>
						) : (
							<span
								className="text-body-secondary small text-end"
								style={{ maxWidth: "260px" }}
							>
								<Icon type="lock" /> Want to submit quests to the community? Ask an
								admin to grant you quest-submitter access.
							</span>
						))}
				</div>

				{/* Editing-proposal banner */}
				{editingProposal && (
					<Alert
						className="mt-3 mb-0 d-flex align-items-center justify-content-between"
						variant="info"
					>
						<span>
							<Icon type="pencil" /> Editing{" "}
							<a
								href={editingProposal.prUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								PR #{editingProposal.prNumber}
							</a>
							{" — "}make your changes, then click <strong>Update PR</strong>.
						</span>
						<Button onClick={clearEditingProposal} size="sm" variant="outline-light">
							Stop editing
						</Button>
					</Alert>
				)}

				<Divider />
			</Col>

			{/* ── Left panel: Quest list ─────────────────────────────────────── */}
			<Col lg={3} xs={12}>
				<div className="d-flex align-items-center justify-content-between mb-2">
					<h5 className="mb-0">Quests</h5>
					<Badge bg="secondary">{quests.length}</Badge>
				</div>

				<QuestList
					onAddQuest={addQuest}
					onSelect={setSelectedQuestIdx}
					quests={quests}
					selectedIdx={selectedQuestIdx}
				/>

				<Divider />

				<div className="d-flex flex-column gap-2">
					{quests.length > 0 && (
						<Button
							onClick={() => downloadJson(quests, `quests-${Date.now()}.json`)}
							size="sm"
							variant="outline-success"
						>
							<Icon type="download" /> Download quests.json
						</Button>
					)}
					<Button
						onClick={() => setShowImportQuests(true)}
						size="sm"
						variant="outline-info"
					>
						<Icon type="upload" /> Import quests.json
					</Button>
					{quests.length > 0 && (
						<Button
							onClick={() => {
								if (confirm("Delete all quests and start over?")) {
									setQuests([]);
									setSelectedQuestIdx(null);
									setEditingProposal(null);
								}
							}}
							size="sm"
							variant="outline-danger"
						>
							Clear All Quests
						</Button>
					)}
				</div>
			</Col>

			{/* ── Centre panel: Quest editor ─────────────────────────────────── */}
			<Col lg={5} xs={12}>
			{selectedQuest && selectedQuestIdx !== null ? (
				<EditableQuest
					key={selectedQuestIdx}
					onChange={(updated) =>
						setQuests(ChangeAtPosition(quests, updated, selectedQuestIdx))
					}
					onDelete={() => {
						setQuests(DeleteInPosition(quests, selectedQuestIdx));
						setSelectedQuestIdx(null);
					}}
					quest={selectedQuest}
				/>
				) : (
					<div className="d-flex h-100 align-items-center justify-content-center text-center text-body-secondary border rounded p-4">
						<div>
							<Icon type="arrow-left" />
							<p className="mt-2 small">Select a quest from the list to edit it.</p>
						</div>
					</div>
				)}
			</Col>

			{/* ── Right panel: Questline composer ───────────────────────────── */}
			<Col lg={4} xs={12}>
				<div className="d-flex align-items-center justify-content-between mb-2">
					<h5 className="mb-0">Questlines</h5>
					<Badge bg="secondary">{questlines.length}</Badge>
				</div>

				<QuestlineComposer
					onAddQuestline={(ql) => setQuestlines((prev) => [...prev, ql])}
					onDelete={(idx) => setQuestlines(DeleteInPosition(questlines, idx))}
					onUpdate={(updated, idx) =>
						setQuestlines(ChangeAtPosition(questlines, updated, idx))
					}
					questlines={questlines}
					quests={quests}
				/>

				<Divider />

				<div className="d-flex flex-column gap-2">
					{questlines.length > 0 && (
						<Button
							onClick={() =>
								downloadJson(questlines, `questlines-${Date.now()}.json`)
							}
							size="sm"
							variant="outline-success"
						>
							<Icon type="download" /> Download questlines.json
						</Button>
					)}
					<Button
						onClick={() => setShowImportQuestlines(true)}
						size="sm"
						variant="outline-info"
					>
						<Icon type="upload" /> Import questlines.json
					</Button>
					{questlines.length > 0 && (
						<Button
							onClick={() => {
								if (confirm("Delete all questlines?")) {
									setQuestlines([]);
								}
							}}
							size="sm"
							variant="outline-danger"
						>
							Clear All Questlines
						</Button>
					)}
				</div>
			</Col>

			{/* ── My Proposals panel ────────────────────────────────────────── */}
			{user && (
				<Col xs={12}>
					<Divider />
					<MyProposalsPanel
						editingProposalID={editingProposal?.proposalID ?? null}
						loading={proposalsLoading}
						onLoad={loadProposalIntoEditor}
						onWithdrawn={fetchProposals}
						proposals={proposals}
					/>
				</Col>
			)}

			{/* Import modals */}
			{showImportQuests && (
				<ImportJsonModal
					description="quests.json"
					onHide={() => setShowImportQuests(false)}
					onImport={(data) => {
						setQuests(data as RawQuestDocument[]);
						setSelectedQuestIdx(null);
					}}
					schema={PR_LOCAL_QUESTS_SCHEMA}
				/>
			)}
			{showImportQuestlines && (
				<ImportJsonModal
					description="questlines.json"
					onHide={() => setShowImportQuestlines(false)}
					onImport={(data) => setQuestlines(data as RawQuestlineDocument[])}
				/>
			)}
			{showSubmitModal && (
				<SubmitProposalModal
					editingProposal={editingProposal}
					onAfterSubmit={handleAfterSubmit}
					onHide={() => setShowSubmitModal(false)}
					questlines={questlines}
					quests={quests}
				/>
			)}
		</Row>
	);
}

// ─── MyProposalsPanel ─────────────────────────────────────────────────────────

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

function MyProposalsPanel({
	proposals,
	loading,
	editingProposalID,
	onLoad,
	onWithdrawn,
}: {
	editingProposalID: string | null;
	loading: boolean;
	onLoad: (p: MyProposal) => void;
	onWithdrawn: () => void;
	proposals: Array<MyProposal> | null;
}) {
	const [withdrawingID, setWithdrawingID] = useState<string | null>(null);

	const handleWithdraw = async (proposal: MyProposal) => {
		if (!confirm(`Withdraw PR #${proposal.prNumber}? This will close it on GitHub.`)) {
			return;
		}

		setWithdrawingID(proposal.proposalID);

		try {
			const res = await APIFetchV1(`/proposals/${proposal.proposalID}`, {
				method: "DELETE",
			});

			if (!res.success) {
				alert(`Failed to withdraw: ${res.description}`);
			} else {
				onWithdrawn();
			}
		} finally {
			setWithdrawingID(null);
		}
	};

	return (
		<div>
			<div className="d-flex align-items-center justify-content-between mb-2">
				<h5 className="mb-0">My Proposals</h5>
				{loading && <Spinner animation="border" size="sm" />}
			</div>

			{proposals === null && !loading && (
				<p className="text-body-secondary small">
					Could not load proposals — are proposals enabled on this instance?
				</p>
			)}

			{proposals !== null && proposals.length === 0 && (
				<p className="text-body-secondary small">
					No proposals yet. Build some quests and click{" "}
					<strong>Submit to Community</strong>!
				</p>
			)}

			{proposals !== null && proposals.length > 0 && (
				<div className="d-flex flex-wrap gap-3">
					{proposals.map((proposal) => {
						const questNames = proposal.rawQuests.map((q) => q.name).join(", ");
						const isEditing = editingProposalID === proposal.proposalID;

						return (
							<div
								className={`border rounded p-3 ${isEditing ? "border-info" : ""}`}
								key={proposal.proposalID}
								style={{ minWidth: "260px", maxWidth: "340px" }}
							>
								<div className="d-flex align-items-start justify-content-between mb-1">
									<span className="text-body-secondary small">
										PR #{proposal.prNumber}
									</span>
									{statusBadge(proposal.status)}
								</div>

								<p className="mb-1 fw-semibold" style={{ fontSize: "0.9rem" }}>
									{questNames}
								</p>

								<p
									className="text-body-secondary mb-2"
									style={{ fontSize: "0.75rem" }}
								>
									{proposal.rawQuests[0]
										? FormatGame(proposal.rawQuests[0].game as V3Game)
										: ""}{" "}
									· {new Date(proposal.createdAt).toLocaleDateString()}
									{proposal.updatedAt !== proposal.createdAt && (
										<>
											{" · "}updated{" "}
											{new Date(proposal.updatedAt).toLocaleDateString()}
										</>
									)}
								</p>

								<div className="d-flex gap-2 flex-wrap">
									<a
										className="btn btn-outline-secondary btn-sm py-0"
										href={proposal.prUrl}
										rel="noopener noreferrer"
										target="_blank"
									>
										GitHub
									</a>

									{proposal.status === "open" && (
										<>
											{isEditing ? (
												<span className="btn btn-info btn-sm py-0 disabled">
													<Icon type="pencil" /> Editing…
												</span>
											) : (
												<Button
													onClick={() => onLoad(proposal)}
													size="sm"
													style={{ padding: "0 0.5rem" }}
													variant="outline-primary"
												>
													<Icon type="pencil" /> Edit
												</Button>
											)}

											<Button
												disabled={withdrawingID === proposal.proposalID}
												onClick={() => handleWithdraw(proposal)}
												size="sm"
												style={{ padding: "0 0.5rem" }}
												variant="outline-danger"
											>
												{withdrawingID === proposal.proposalID ? (
													<Spinner animation="border" size="sm" />
												) : (
													"Withdraw"
												)}
											</Button>
										</>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

// ─── QuestList ────────────────────────────────────────────────────────────────

function QuestList({
	quests,
	selectedIdx,
	onSelect,
	onAddQuest,
}: {
	onAddQuest: (gpt: LEGACY_GPTString) => void;
	onSelect: (idx: number) => void;
	quests: Array<RawQuestDocument>;
	selectedIdx: number | null;
}) {
	const [gpt, setGpt] = useState<LEGACY_GPTString | null>(null);

	const allGpts: Array<{ label: string; value: LEGACY_GPTString }> =
		TachiConfig.GAME_GROUPS.flatMap((gameGroup) => {
			const config = GetGameGroupConfig(gameGroup);

			return config.playtypes.map((pt) => ({
				value: `${gameGroup}:${pt}` as LEGACY_GPTString,
				label: FormatGame(LEGACY_GameGroupPTToGame(gameGroup, pt)),
			}));
		});

	return (
		<div className="d-flex flex-column gap-1 mb-3">
			{quests.length === 0 && (
				<span className="text-body-secondary small">No quests yet. Add one below.</span>
			)}
			{quests.map((quest, i) => (
				<button
					className={`btn btn-sm text-start text-truncate ${
						selectedIdx === i ? "btn-primary" : "btn-outline-secondary"
					}`}
					key={i}
					onClick={() => onSelect(i)}
					title={quest.name}
					type="button"
				>
					<span className="small me-2 text-body-secondary">{FormatGame(quest.game)}</span>
					{quest.name}
				</button>
			))}

			{/* Inline new-quest form */}
			<div className="mt-2 d-flex gap-2 align-items-center">
				<Form.Select
					onChange={(e) => setGpt(e.target.value as LEGACY_GPTString)}
					size="sm"
					style={{ flex: 1 }}
					value={gpt ?? ""}
				>
					<option value="">Game…</option>
					{allGpts.map((g) => (
						<option key={g.value} value={g.value}>
							{g.label}
						</option>
					))}
				</Form.Select>
				<Button
					disabled={gpt === null}
					onClick={() => {
						if (gpt) {
							onAddQuest(gpt);
						}
					}}
					size="sm"
					variant="success"
				>
					<Icon type="plus" />
				</Button>
			</div>
		</div>
	);
}

// ─── QuestlineComposer ────────────────────────────────────────────────────────

function QuestlineComposer({
	questlines,
	quests,
	onAddQuestline,
	onUpdate,
	onDelete,
}: {
	onAddQuestline: (ql: RawQuestlineDocument) => void;
	onDelete: (idx: number) => void;
	onUpdate: (updated: RawQuestlineDocument, idx: number) => void;
	questlines: Array<RawQuestlineDocument>;
	quests: Array<RawQuestDocument>;
}) {
	const [newName, setNewName] = useState("");
	const [newGame, setNewGame] = useState<"" | LEGACY_GPTString>("");

	const allGpts: Array<{ label: string; value: LEGACY_GPTString }> =
		TachiConfig.GAME_GROUPS.flatMap((gameGroup) => {
			const config = GetGameGroupConfig(gameGroup);

			return config.playtypes.map((pt) => ({
				value: `${gameGroup}:${pt}` as LEGACY_GPTString,
				label: FormatGame(LEGACY_GameGroupPTToGame(gameGroup, pt)),
			}));
		});

	return (
		<div className="d-flex flex-column gap-3 mb-3">
			{questlines.length === 0 && (
				<span className="text-body-secondary small">No questlines yet.</span>
			)}

			{questlines.map((ql, idx) => (
				<QuestlineCard
					key={idx}
					onDelete={() => onDelete(idx)}
					onUpdate={(updated) => onUpdate(updated, idx)}
					questline={ql}
					quests={quests}
				/>
			))}

			{/* New questline inline form */}
			<div className="border rounded p-2">
				<p className="small fw-semibold mb-2">New Questline</p>
				<Form.Control
					className="mb-2"
					onChange={(e) => setNewName(e.target.value)}
					placeholder="Questline name…"
					size="sm"
					value={newName}
				/>
				<div className="d-flex gap-2">
					<Form.Select
						onChange={(e) => setNewGame(e.target.value as LEGACY_GPTString)}
						size="sm"
						style={{ flex: 1 }}
						value={newGame}
					>
						<option value="">Game…</option>
						{allGpts.map((g) => (
							<option key={g.value} value={g.value}>
								{g.label}
							</option>
						))}
					</Form.Select>
					<Button
						disabled={!newName.trim() || !newGame}
						onClick={() => {
							if (!newName.trim() || !newGame) {
								return;
							}

							const [gameGroup, playtype] = newGame.split(":") as [
								GameGroup,
								LEGACY_Playtype,
							];

							const v3Game = LEGACY_GameGroupPTToGame(gameGroup, playtype);

							const slug = newName
								.trim()
								.toLowerCase()
								.replace(/\s+/gu, "-")
								.replace(/[^a-z0-9-]/gu, "");

							onAddQuestline({
								questlineID: `${slug}-${Date.now()}`,
								name: newName.trim(),
								desc: "",
								game: v3Game,
								quests: [],
							});

							setNewName("");
							setNewGame("");
						}}
						size="sm"
						variant="success"
					>
						<Icon type="plus" /> Create
					</Button>
				</div>
			</div>
		</div>
	);
}

function QuestlineCard({
	questline,
	quests,
	onUpdate,
	onDelete,
}: {
	onDelete: () => void;
	onUpdate: (updated: RawQuestlineDocument) => void;
	questline: RawQuestlineDocument;
	quests: Array<RawQuestDocument>;
}) {
	const availableQuests = quests.filter((q) => !questline.quests.includes(q.name));

	const addQuestByName = (name: string) => {
		if (!questline.quests.includes(name)) {
			onUpdate({ ...questline, quests: [...questline.quests, name] });
		}
	};

	const removeQuest = (name: string) => {
		onUpdate({ ...questline, quests: questline.quests.filter((q) => q !== name) });
	};

	const moveQuest = (idx: number, direction: -1 | 1) => {
		const arr = [...questline.quests];
		const target = idx + direction;

		if (target < 0 || target >= arr.length) {
			return;
		}

		[arr[idx], arr[target]] = [arr[target]!, arr[idx]!];
		onUpdate({ ...questline, quests: arr });
	};

	return (
		<div className="border rounded p-2">
			<div className="d-flex align-items-start gap-2 mb-1">
				<div className="flex-grow-1">
					<EditableText
						as="span"
						authorised
						initialText={questline.name}
						onSubmit={(name) => onUpdate({ ...questline, name })}
						placeholderText="Questline name"
					/>
					<EditableText
						authorised
						initialText={questline.desc}
						onSubmit={(desc) => onUpdate({ ...questline, desc })}
						placeholderText="Description…"
					/>
					<span className="text-body-secondary small">{questline.game}</span>
				</div>
				<button
					className="btn btn-outline-danger btn-sm py-0"
					onClick={() => {
						if (confirm(`Delete questline "${questline.name}"?`)) {
							onDelete();
						}
					}}
					type="button"
				>
					<Icon type="trash" />
				</button>
			</div>

			{/* Ordered quest list */}
			{questline.quests.length === 0 ? (
				<span className="text-body-secondary small">No quests added yet.</span>
			) : (
				<div className="d-flex flex-column gap-1 mb-2">
					{questline.quests.map((questName, i) => (
						<div className="d-flex align-items-center gap-1" key={i}>
							<span className="text-body-secondary small me-1">{i + 1}.</span>
							<span className="flex-grow-1 small text-truncate">{questName}</span>
							<button
								className="btn btn-outline-secondary btn-sm py-0"
								disabled={i === 0}
								onClick={() => moveQuest(i, -1)}
								type="button"
							>
								<Icon type="chevron-up" />
							</button>
							<button
								className="btn btn-outline-secondary btn-sm py-0"
								disabled={i === questline.quests.length - 1}
								onClick={() => moveQuest(i, 1)}
								type="button"
							>
								<Icon type="chevron-down" />
							</button>
							<button
								className="btn btn-outline-danger btn-sm py-0"
								onClick={() => removeQuest(questName)}
								type="button"
							>
								<Icon type="times" />
							</button>
						</div>
					))}
				</div>
			)}

			{/* Add quest from available */}
			{availableQuests.length > 0 && (
				<Form.Select
					onChange={(e) => {
						if (e.target.value) {
							addQuestByName(e.target.value);
							e.target.value = "";
						}
					}}
					size="sm"
				>
					<option value="">Add quest…</option>
					{availableQuests.map((q, i) => (
						<option key={i} value={q.name}>
							{q.name} ({FormatGame(q.game)})
						</option>
					))}
				</Form.Select>
			)}
		</div>
	);
}

// ─── SubmitProposalModal ──────────────────────────────────────────────────────

type SubmitResult = {
	prNumber: number;
	proposalID: string;
	prUrl: string;
	status: string;
};

function SubmitProposalModal({
	editingProposal,
	onAfterSubmit,
	onHide,
	questlines,
	quests,
}: {
	editingProposal: MyProposal | null;
	onAfterSubmit: () => void;
	onHide: () => void;
	questlines: Array<RawQuestlineDocument>;
	quests: Array<RawQuestDocument>;
}) {
	const isUpdate = editingProposal !== null;

	const [prTitle, setPrTitle] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<SubmitResult | null>(null);
	const [err, setErr] = useState<string | null>(null);

	const handleSubmit = async () => {
		setErr(null);
		setSubmitting(true);

		try {
			const res = isUpdate
				? await APIFetchV1<SubmitResult>(`/proposals/${editingProposal.proposalID}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							quests,
							questlines: questlines.length > 0 ? questlines : undefined,
						}),
					})
				: await APIFetchV1<SubmitResult>("/proposals", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							quests,
							questlines: questlines.length > 0 ? questlines : undefined,
							prTitle: prTitle.trim() || undefined,
						}),
					});

			if (!res.success) {
				setErr(res.description);
				return;
			}

			setResult(res.body);
			onAfterSubmit();
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Modal onHide={onHide} show>
			<Modal.Header closeButton>
				<Modal.Title>
					{isUpdate ? `Update PR #${editingProposal.prNumber}` : "Submit to Community"}
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				{result ? (
					<div>
						<Alert variant="success">
							{isUpdate ? (
								<>
									<strong>PR updated!</strong> A new commit has been pushed to{" "}
									<a
										href={result.prUrl}
										rel="noopener noreferrer"
										target="_blank"
									>
										PR #{result.prNumber}
									</a>
									.
								</>
							) : (
								<>
									<strong>PR opened!</strong> Your quests have been submitted for
									review.
								</>
							)}
						</Alert>
						<a
							className="btn btn-outline-primary btn-sm"
							href={result.prUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							<Icon type="code-branch" /> View on GitHub
						</a>
					</div>
				) : (
					<>
						{isUpdate ? (
							<p className="text-body-secondary small">
								This will push a new commit to{" "}
								<a
									href={editingProposal.prUrl}
									rel="noopener noreferrer"
									target="_blank"
								>
									PR #{editingProposal.prNumber}
								</a>{" "}
								with your updated quests.
							</p>
						) : (
							<p className="text-body-secondary small">
								This will open a pull request on GitHub with your quests. A reviewer
								will check the content before it&apos;s merged into the site.
							</p>
						)}

						<h6>Quests ({quests.length})</h6>
						<ul className="small">
							{quests.map((q, i) => (
								<li key={i}>
									<strong>{q.name}</strong>{" "}
									<span className="text-body-secondary">({q.game})</span>
								</li>
							))}
						</ul>

						{questlines.length > 0 && (
							<>
								<h6>Questlines ({questlines.length})</h6>
								<ul className="small">
									{questlines.map((ql, i) => (
										<li key={i}>
											<strong>{ql.name}</strong>
										</li>
									))}
								</ul>
							</>
						)}

						{!isUpdate && (
							<Form.Group className="mt-3">
								<Form.Label>PR title (optional)</Form.Label>
								<Form.Control
									maxLength={200}
									onChange={(e) => setPrTitle(e.target.value)}
									placeholder={`Add quest: ${quests.map((q) => q.name).join(", ")}`}
									type="text"
									value={prTitle}
								/>
							</Form.Group>
						)}

						{err && (
							<Alert className="mt-3" variant="danger">
								{err}
							</Alert>
						)}
					</>
				)}
			</Modal.Body>
			{!result && (
				<Modal.Footer>
					<Button disabled={submitting} onClick={onHide} variant="secondary">
						Cancel
					</Button>
					<Button disabled={submitting} onClick={handleSubmit} variant="success">
						{submitting
							? isUpdate
								? "Updating…"
								: "Submitting…"
							: isUpdate
								? "Update PR"
								: "Submit PR"}
					</Button>
				</Modal.Footer>
			)}
		</Modal>
	);
}

// ─── ImportJsonModal ──────────────────────────────────────────────────────────

function ImportJsonModal({
	description,
	onHide,
	onImport,
	schema,
}: {
	description: string;
	onHide: () => void;
	onImport: (data: unknown[]) => void;
	schema?: PrudenceSchema;
}) {
	const [err, setErr] = useState<string | null>(null);

	return (
		<Modal onHide={onHide} show size="lg">
			<Modal.Header closeButton>
				<Modal.Title>Import {description}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Alert variant="warning">
					This will replace your current {description} data. Make sure you've exported
					first!
				</Alert>
				<Form.Group>
					<Form.Label>Upload {description}</Form.Label>
					<input
						accept="application/json"
						className="form-control"
						multiple={false}
						onChange={async (e) => {
							try {
								const file = e.target.files?.[0];

								if (!file) {
									return;
								}

								const contents = JSON.parse(await file.text()) as unknown[];

								if (schema) {
									const prErr = p({ json: contents }, schema);

									if (prErr) {
										throw new Error(FormatPrError(prErr));
									}
								}

								onImport(contents);
								onHide();
							} catch (e) {
								setErr((e as Error).message);
							}
						}}
						type="file"
					/>
				</Form.Group>
				{err && <p className="text-danger small mt-2">Invalid file: {err}</p>}
			</Modal.Body>
		</Modal>
	);
}
