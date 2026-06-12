import GoalSubInfo from "#components/targets/GoalSubInfo";
import SetNewGoalModal from "#components/targets/SetNewGoalModal";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { TargetsContext } from "#context/TargetsContext";
import { type GoalsOnFolderReturn } from "#types/api-returns";
import { type GameProfileProps } from "#types/react";
import { CreateGoalSubDataset, CreateUserMap } from "#util/data";
import React, { useContext, useReducer, useState } from "react";
import { Button, Col } from "react-bootstrap";
import { type FolderDocument } from "tachi-common";

export default function FolderQuestsPage({
	folder,
	game,
	reqUser,
}: {
	folder: FolderDocument;
} & GameProfileProps) {
	const [refresh, forceRefresh] = useReducer((x) => x + 1, 0);
	const { reloadTargets } = useContext(TargetsContext);

	const { data, error } = useApiQuery<GoalsOnFolderReturn>(
		`/users/${reqUser.id}/games/${game}/targets/on-folder/${folder.slug}`,
		undefined,
		[refresh],
	);

	const [show, setShow] = useState(false);

	return (
		<div>
			<Col className="w-100 d-flex justify-content-center" xs={12}>
				<Button onClick={() => setShow(true)} variant="outline-success">
					Set New Folder Goal
				</Button>
			</Col>
			<Divider />
			{error && <ApiError error={error} />}
			{data ? <FolderQuestsInner {...{ reqUser, game, folder, data }} /> : <Loading />}

			{show && (
				<SetNewGoalModal
					{...{ game, reqUser, show, setShow }}
					onNewGoalSet={() => {
						forceRefresh();
						reloadTargets();
					}}
					preData={folder}
				/>
			)}
		</div>
	);
}

function FolderQuestsInner({
	reqUser,
	game,
	folder,
	data,
}: {
	data: GoalsOnFolderReturn;
	folder: FolderDocument;
} & GameProfileProps) {
	const userMap = CreateUserMap([reqUser]);

	return <GoalSubInfo dataset={CreateGoalSubDataset(data, userMap)} game={game} />;
}
