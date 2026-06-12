import GoalSubInfo from "#components/targets/GoalSubInfo";
import SetNewGoalModal from "#components/targets/SetNewGoalModal";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import { type GoalsOnChartReturn } from "#types/api-returns";
import { type GameProfileProps } from "#types/react";
import { type UnsuccessfulAPIFetchResponse } from "#util/api";
import { CreateGoalSubDataset, CreateUserMap } from "#util/data";
import React, { useState } from "react";
import { Button, Col } from "react-bootstrap";
import { type ChartDocument, FormatChart, type SongDocument } from "tachi-common";

export default function TargetInfo({
	data,
	error,
	game,
	reqUser,
	chart,
	song,
	onGoalSet,
}: {
	chart: ChartDocument;
	data: GoalsOnChartReturn | undefined;
	error: UnsuccessfulAPIFetchResponse | null;
	onGoalSet: () => void;
	song: SongDocument;
} & GameProfileProps) {
	const [show, setShow] = useState(false);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const userMap = CreateUserMap([reqUser]);

	const dataset = CreateGoalSubDataset(data, userMap);

	return (
		<div className="w-100">
			<Col xs={12}>
				<h1>Your Goals involving {FormatChart(chart)}</h1>
				<Divider />
			</Col>
			<Col xs={12}>
				<GoalSubInfo dataset={dataset} game={game} />
			</Col>

			<Divider />
			<Button onClick={() => setShow(true)} variant="outline-success">
				<Icon type="bullseye" /> Set New Goal
			</Button>
			<SetNewGoalModal
				game={game}
				onNewGoalSet={onGoalSet}
				preData={{ chart, song }}
				reqUser={reqUser}
				setShow={setShow}
				show={show}
			/>
		</div>
	);
}
