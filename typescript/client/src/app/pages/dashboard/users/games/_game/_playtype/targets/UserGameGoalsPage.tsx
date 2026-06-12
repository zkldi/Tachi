import DeleteGoalsModal from "#components/targets/DeleteGoalsModal";
import GoalBuilder from "#components/targets/GoalBuilder";
import GoalSubInfo from "#components/targets/GoalSubInfo";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TargetsContext } from "#context/TargetsContext";
import { type AllUserGameGoalsReturn } from "#types/api-returns";
import { type GameProfileProps } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { CreateGoalSubDataset } from "#util/data";
import { useContext, useReducer, useState } from "react";
import { Button, Col, Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FormatGame, type GoalDocument } from "tachi-common";

export default function UserGameGoalsPage({ reqUser, game }: GameProfileProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [showDelete, setShowDelete] = useState(false);
	const [editingGoal, setEditingGoal] = useState<GoalDocument | null>(null);
	const { reloadTargets } = useContext(TargetsContext);
	const [refresh, refetchGoals] = useReducer((x) => x + 1, 0);

	const { data, error } = useApiQuery<AllUserGameGoalsReturn>(
		`/users/${reqUser.id}/games/${game}/targets/goals`,
		undefined,
		[refresh.toString()],
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const userMap = new Map([[reqUser.id, reqUser]]);
	const dataset = CreateGoalSubDataset(data, userMap);

	const handleAddGoal = async (rawGoal: {
		goal: Pick<GoalDocument, "charts" | "criteria" | "name">;
	}) => {
		await APIFetchV1(
			`/users/${reqUser.id}/games/${game}/targets/goals/add-goal`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					criteria: rawGoal.goal.criteria,
					charts: rawGoal.goal.charts,
				}),
			},
			true,
			true,
		);

		setShowAdd(false);
		refetchGoals();
		reloadTargets();
	};

	const handleUpdateGoal = async (
		oldGoalID: string,
		rawGoal: { goal: Pick<GoalDocument, "charts" | "criteria" | "name"> },
	) => {
		await APIFetchV1(
			`/users/${reqUser.id}/games/${game}/targets/goals/${oldGoalID}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					criteria: rawGoal.goal.criteria,
					charts: rawGoal.goal.charts,
				}),
			},
			true,
			true,
		);

		setEditingGoal(null);
		refetchGoals();
		reloadTargets();
	};

	return (
		<div>
			<Col xs={12}>
				<Button
					className="mb-4 w-100"
					onClick={() => setShowAdd(true)}
					size="lg"
					variant="outline-success"
				>
					<Icon type="bullseye" /> Add New Goal
				</Button>
				<Button
					className="mb-4 w-100"
					onClick={() => setShowDelete(true)}
					size="lg"
					variant="outline-danger"
				>
					<Icon type="trash" /> Delete Goals
				</Button>
				<div>
					Looking for goal recommendations?{" "}
					<Link to={`/games/${game}/quests`}>Check out {FormatGame(game)}'s Quests</Link>.
				</div>
				<Divider />
				<GoalSubInfo
					dataset={dataset}
					game={game}
					onEditGoal={(goal) => setEditingGoal(goal)}
				/>
			</Col>

			{/* Add goal modal */}
			<Modal onHide={() => setShowAdd(false)} show={showAdd} size="xl">
				<Modal.Header closeButton>
					<Modal.Title>Add New Goal</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<GoalBuilder confirmLabel="Add Goal" game={game} onCreate={handleAddGoal} />
				</Modal.Body>
			</Modal>

			{/* Update goal modal */}
			{editingGoal && (
				<Modal onHide={() => setEditingGoal(null)} show size="xl">
					<Modal.Header closeButton>
						<Modal.Title>Update Goal</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<GoalBuilder
							confirmLabel="Update Goal"
							existingGoal={editingGoal}
							game={game}
							onCreate={(rawGoal) => handleUpdateGoal(editingGoal.goalID, rawGoal)}
						/>
					</Modal.Body>
				</Modal>
			)}

			{showDelete && (
				<DeleteGoalsModal
					dataset={dataset}
					onDelete={async (goalID) => {
						await APIFetchV1(
							`/users/${reqUser.id}/games/${game}/targets/goals/${goalID}`,
							{ method: "DELETE" },
							true,
							true,
						);

						refetchGoals();
						reloadTargets();
					}}
					setShow={setShowDelete}
					show={showDelete}
				/>
			)}
		</div>
	);
}
