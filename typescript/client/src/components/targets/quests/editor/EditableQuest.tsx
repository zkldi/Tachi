import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Card from "#components/layout/page/Card";
import GoalBuilder from "#components/targets/GoalBuilder";
import Divider from "#components/util/Divider";
import EditableText from "#components/util/EditableText";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import { type GameProps } from "#types/react";
import { type RawQuestDocument, type RawQuestGoal, type RawQuestSection } from "#types/tachi";
import { ChangeAtPosition, CopyToClipboard, DeleteInPosition } from "#util/misc";
import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { FormatGame } from "tachi-common";

export default function EditableQuest({
	quest,
	onChange,
	onDelete,
}: {
	onChange: (rq: RawQuestDocument) => void;
	onDelete: () => void;
	quest: RawQuestDocument;
}) {
	return (
		<Card
			header={
				<div className="vstack gap-2">
					<EditableText
						as="h4"
						authorised
						initialText={quest.name}
						onSubmit={(name) => onChange({ ...quest, name })}
						placeholderText={quest.name || "Untitled Quest"}
					/>
					<EditableText
						authorised
						initialText={quest.desc}
						onSubmit={(desc) => onChange({ ...quest, desc })}
						placeholderText={quest.desc || "Please set a description."}
					/>
					<Muted>{FormatGame(quest.game)}</Muted>
				</div>
			}
		>
			{quest.rawQuestData.map((section, i) => (
				<React.Fragment key={i}>
					<QuestSection
						game={quest.game}
						onChange={(newSection) =>
							onChange({
								...quest,
								rawQuestData: ChangeAtPosition(quest.rawQuestData, newSection, i),
							})
						}
						onDelete={() =>
							onChange({
								...quest,
								rawQuestData: DeleteInPosition(quest.rawQuestData, i),
							})
						}
						onMoveDown={
							i < quest.rawQuestData.length - 1
								? () => {
										const arr = [...quest.rawQuestData];
										[arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
										onChange({ ...quest, rawQuestData: arr });
									}
								: undefined
						}
						onMoveUp={
							i > 0
								? () => {
										const arr = [...quest.rawQuestData];
										[arr[i - 1], arr[i]] = [arr[i]!, arr[i - 1]!];
										onChange({ ...quest, rawQuestData: arr });
									}
								: undefined
						}
						section={section}
					/>
					<Divider />
				</React.Fragment>
			))}

			<div className="d-flex w-100 justify-content-center">
				<Button
					onClick={() =>
						onChange({
							...quest,
							rawQuestData: [
								...quest.rawQuestData,
								{ title: "New Section", desc: "", rawGoals: [] },
							],
						})
					}
					variant="outline-success"
				>
					<Icon type="plus" /> Add Section
				</Button>
			</div>

			<Divider />

			<div className="d-flex w-100 gap-2">
				<QuickTooltip tooltipContent="Copy this quest as a readable summary.">
					<Button
						onClick={() => CopyToClipboard(FormatQuestAsText(quest))}
						variant="outline-info"
					>
						Copy Summary
					</Button>
				</QuickTooltip>
				<div className="ms-auto">
					<Button
						onClick={() => {
							if (confirm("Delete this quest?")) {
								onDelete();
							}
						}}
						variant="outline-danger"
					>
						<Icon noPad type="trash" />
					</Button>
				</div>
			</div>
		</Card>
	);
}

function QuestSection({
	section,
	game,
	onChange,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	onChange: (newSection: RawQuestSection) => void;
	onDelete: () => void;
	onMoveDown?: () => void;
	onMoveUp?: () => void;
	section: RawQuestSection;
} & GameProps) {
	const [showGoalBuilder, setShowGoalBuilder] = useState(false);

	return (
		<div>
			<div className="d-flex align-items-start gap-2 mb-2">
				<div className="flex-grow-1">
					<EditableText
						as="h5"
						authorised
						initialText={section.title}
						onSubmit={(title) => onChange({ ...section, title })}
						placeholderText="Section Title"
					/>
					<EditableText
						authorised
						initialText={section.desc}
						onSubmit={(desc) => onChange({ ...section, desc })}
						placeholderText="Optional section description…"
					/>
				</div>
				{/* Reorder buttons */}
				<div className="d-flex flex-column gap-1">
					<button
						className="btn btn-outline-secondary btn-sm py-0"
						disabled={!onMoveUp}
						onClick={onMoveUp}
						title="Move section up"
						type="button"
					>
						<Icon type="chevron-up" />
					</button>
					<button
						className="btn btn-outline-secondary btn-sm py-0"
						disabled={!onMoveDown}
						onClick={onMoveDown}
						title="Move section down"
						type="button"
					>
						<Icon type="chevron-down" />
					</button>
				</div>
			</div>

			{section.rawGoals.length === 0 ? (
				<span className="text-body-secondary small">No goals yet.</span>
			) : (
				<div className="d-flex flex-column gap-1 mb-2">
					{section.rawGoals.map((rawGoal, i) => (
						<EditableGoalRow
							game={game}
							key={i}
							onDelete={() =>
								onChange({
									...section,
									rawGoals: DeleteInPosition(section.rawGoals, i),
								})
							}
							onMoveDown={
								i < section.rawGoals.length - 1
									? () => {
											const arr = [...section.rawGoals];
											[arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
											onChange({ ...section, rawGoals: arr });
										}
									: undefined
							}
							onMoveUp={
								i > 0
									? () => {
											const arr = [...section.rawGoals];
											[arr[i - 1], arr[i]] = [arr[i]!, arr[i - 1]!];
											onChange({ ...section, rawGoals: arr });
										}
									: undefined
							}
							onUpdate={(newGoal) =>
								onChange({
									...section,
									rawGoals: ChangeAtPosition(section.rawGoals, newGoal, i),
								})
							}
							rawGoal={rawGoal}
						/>
					))}
				</div>
			)}

			<div className="d-flex gap-2 mt-2">
				<Button
					onClick={() => setShowGoalBuilder(true)}
					size="sm"
					variant="outline-success"
				>
					<Icon type="plus" /> Add Goal
				</Button>
				<Button
					className="ms-auto"
					onClick={() => {
						if (confirm("Delete this section?")) {
							onDelete();
						}
					}}
					size="sm"
					variant="outline-danger"
				>
					<Icon type="times" /> Delete Section
				</Button>
			</div>

			{/* GoalBuilder modal */}
			<Modal onHide={() => setShowGoalBuilder(false)} show={showGoalBuilder} size="xl">
				<Modal.Header closeButton>
					<Modal.Title>Add Goal to "{section.title}"</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<GoalBuilder
						confirmLabel="Add Goal"
						game={game}
						onCreate={(rawGoal) => {
							onChange({ ...section, rawGoals: [...section.rawGoals, rawGoal] });
							setShowGoalBuilder(false);
						}}
						showNote
					/>
				</Modal.Body>
			</Modal>
		</div>
	);
}

function EditableGoalRow({
	rawGoal,
	game,
	onUpdate,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	onDelete: () => void;
	onMoveDown?: () => void;
	onMoveUp?: () => void;
	onUpdate: (newGoal: RawQuestGoal) => void;
	rawGoal: RawQuestGoal;
} & GameProps) {
	const [showEdit, setShowEdit] = useState(false);

	return (
		<div className="d-flex align-items-center gap-2 rounded border px-2 py-1">
			<Icon style={{ fontSize: "0.4rem" }} type="circle" />
			<span className="flex-grow-1 small">{rawGoal.goal.name}</span>
			{rawGoal.note && (
				<span className="text-body-secondary small fst-italic">{rawGoal.note}</span>
			)}

			<div className="d-flex gap-1 ms-auto">
				<button
					className="btn btn-outline-secondary btn-sm py-0"
					disabled={!onMoveUp}
					onClick={onMoveUp}
					title="Move up"
					type="button"
				>
					<Icon type="chevron-up" />
				</button>
				<button
					className="btn btn-outline-secondary btn-sm py-0"
					disabled={!onMoveDown}
					onClick={onMoveDown}
					title="Move down"
					type="button"
				>
					<Icon type="chevron-down" />
				</button>
				<button
					className="btn btn-outline-warning btn-sm py-0"
					onClick={() => setShowEdit(true)}
					title="Edit goal"
					type="button"
				>
					<Icon type="pencil-alt" />
				</button>
				<button
					className="btn btn-outline-danger btn-sm py-0"
					onClick={() => {
						if (confirm(`Remove goal "${rawGoal.goal.name}"?`)) {
							onDelete();
						}
					}}
					title="Remove goal"
					type="button"
				>
					<Icon type="trash" />
				</button>
			</div>

			{showEdit && (
				<Modal onHide={() => setShowEdit(false)} show size="xl">
					<Modal.Header closeButton>
						<Modal.Title>Edit Goal</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<GoalBuilder
							confirmLabel="Update Goal"
							existingGoal={{ ...rawGoal.goal, goalID: "" } as any}
							game={game}
							onCreate={(updated) => {
								onUpdate(updated);
								setShowEdit(false);
							}}
							showNote
						/>
					</Modal.Body>
				</Modal>
			)}
		</div>
	);
}

function FormatQuestAsText(quest: RawQuestDocument): string {
	let str = `# ${quest.name}\n${quest.desc}\n(${FormatGame(quest.game)})`;

	for (const section of quest.rawQuestData) {
		str += `\n\n### ${section.title}`;

		if (section.desc) {
			str += `\n${section.desc}`;
		}

		str += "\n";

		for (const goal of section.rawGoals) {
			str += `\n- ${goal.goal.name}`;

			if (goal.note) {
				str += `\n  ${goal.note}`;
			}
		}
	}

	return str;
}
