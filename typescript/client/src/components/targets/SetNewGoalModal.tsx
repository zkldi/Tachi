import CheckEdit from "#components/util/CheckEdit";
import Divider from "#components/util/Divider";
import Select from "#components/util/Select";
import { type GameProfileProps, type GameProps, type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { clamp, UppercaseFirst } from "#util/misc";
import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row } from "react-bootstrap";
import {
	type ChartDocument,
	type FolderDocument,
	FormatChart,
	GetGameConfig,
	GetScoreMetricConf,
	GetScoreMetrics,
	type GoalDocument,
	type SongDocument,
} from "tachi-common";
import { type ConfEnumScoreMetric } from "tachi-common/types/metrics";

export default function SetNewGoalModal({
	show,
	setShow,
	game,
	reqUser,
	preData,
	onNewGoalSet,
}: {
	onNewGoalSet?: () => void;
	preData: FolderDocument | { chart: ChartDocument; song: SongDocument };
	setShow: SetState<boolean>;
	show: boolean;
} & GameProfileProps) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(
		gameConfig,
		gameConfig.preferredDefaultEnum,
	) as ConfEnumScoreMetric<string>;

	const [criteria, setCriteria] = useState<GoalDocument["criteria"]>({
		mode: "single",
		key: gameConfig.preferredDefaultEnum,
		value: conf.values.indexOf(conf.minimumRelevantValue),
	});

	const charts = useMemo<GoalDocument["charts"]>(
		() =>
			"folderID" in preData
				? {
						type: "folder",
						data: preData.folderID,
					}
				: {
						type: "single",
						data: preData.chart.chartID,
					},
		[preData],
	);

	const identifier =
		"folderID" in preData ? `the '${preData.title}' folder` : FormatChart(preData.chart);

	return (
		<Modal onHide={() => setShow(false)} show={show} size="xl">
			<Modal.Header closeButton>
				<Modal.Title>Set Goal for {identifier}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Row>
					{/* <Col xs={12}>
						<RenderGoalChartSet charts={charts} identifier={identifier} />
					</Col> */}
					<Col xs={12}>
						<RenderGoalCriteriaPicker
							charts={charts}
							criteria={criteria}
							game={game}
							setCriteria={setCriteria}
						/>

						<Divider />
					</Col>
					<Col className="w-100 d-flex justify-content-center" xs={12}>
						<Button
							disabled={criteria.mode === "absolute" && criteria.countNum <= 1}
							onClick={() => {
								APIFetchV1(
									`/users/${reqUser.id}/games/${game}/targets/goals/add-goal`,
									{
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											criteria,
											charts,
										}),
									},
									true,
									true,
								).then((r) => {
									if (r.success) {
										setShow(false);
										onNewGoalSet?.();
									}
								});
							}}
							variant="primary"
						>
							Set Goal!
						</Button>
					</Col>
				</Row>
			</Modal.Body>
		</Modal>
	);
}

export function RenderGoalCriteriaPicker({
	criteria,
	charts,
	setCriteria,
	game,
}: {
	charts: GoalDocument["charts"];
	criteria: GoalDocument["criteria"];
	setCriteria: SetState<GoalDocument["criteria"]>;
} & GameProps) {
	const gameConfig = GetGameConfig(game);

	return (
		<>
			<div>
				<Select
					inline
					setValue={(key) => {
						const baseKeyValue = getBaseKeyValue(game, key);
						setCriteria({
							...criteria,
							key,
							value: baseKeyValue,
						});
					}}
					value={criteria.key}
				>
					{GetScoreMetrics(gameConfig, ["ENUM", "DECIMAL", "INTEGER"]).map((e) => (
						<option key={e} value={e}>
							{UppercaseFirst(e)}
						</option>
					))}
				</Select>
				is greater than or equal to
				<div className="form-group" style={{ display: "inline" }}>
					<CriteriaValuePicker
						criteria={criteria}
						game={game}
						onChange={(value) =>
							setCriteria({
								...criteria,
								value,
							})
						}
					/>
				</div>
			</div>
			{charts.type !== "single" && (
				<>
					<Divider />
					<CriteriaModePicker
						charts={charts}
						criteria={criteria}
						game={game}
						onChange={(mode, countNum) => {
							if (mode === "single") {
								setCriteria({
									mode: "single",
									key: criteria.key,
									value: criteria.value,
								});
							} else {
								setCriteria({
									...criteria,
									// shouldn't happen, but default to 0 ig
									countNum: countNum ?? 0,
									mode,
								});
							}
						}}
					/>
				</>
			)}
		</>
	);
}

function CriteriaModePicker({
	criteria,
	onChange,
	charts,
}: {
	charts: GoalDocument["charts"];
	criteria: GoalDocument["criteria"];
	onChange: (value: GoalDocument["criteria"]["mode"], countNum?: number) => void;
} & GameProps) {
	const [absCountNum, setAbsCountNum] = useState(
		criteria.mode === "absolute" ? criteria.countNum : 10,
	);
	const [perCountNum, setPerCountNum] = useState(
		criteria.mode === "proportion" ? criteria.countNum * 100 : 10,
	);

	useEffect(() => {
		if (criteria.mode === "proportion") {
			onChange("proportion", perCountNum / 100);
		} else if (criteria.mode === "absolute") {
			onChange("absolute", absCountNum);
		}
	}, [absCountNum, perCountNum]);

	if ("data" in charts && charts.data === null) {
		return <></>;
	}

	return (
		<>
			<CheckEdit
				currentType={criteria.mode}
				onChange={() => onChange("single")}
				type="single"
			>
				{charts.type === "multi" ? "On any of these charts" : "On any chart in this folder"}
			</CheckEdit>
			<CheckEdit
				currentType={criteria.mode}
				onChange={() => onChange("absolute", Number(absCountNum))}
				type="absolute"
			>
				On{" "}
				<Form.Control
					className="mx-2"
					min={2}
					onChange={(e) => setAbsCountNum(Number(e.target.value))}
					style={{ display: "inline", width: "unset" }}
					type="number"
					value={absCountNum}
				/>{" "}
				{charts.type === "multi" ? "of these charts" : "charts in this folder"}
			</CheckEdit>
			{charts.type !== "multi" && (
				<CheckEdit
					currentType={criteria.mode}
					onChange={() => onChange("proportion", perCountNum / 100)}
					type="proportion"
				>
					On
					<Form.Control
						className="mx-2"
						max={100}
						min={0}
						onChange={(e) => setPerCountNum(clamp(Number(e.target.value), 0, 100))}
						style={{ display: "inline", width: "unset" }}
						type="number"
						value={perCountNum}
					/>
					% of charts in this folder
				</CheckEdit>
			)}
		</>
	);
}

function CriteriaValuePicker({
	criteria,
	game,
	onChange,
}: {
	criteria: GoalDocument["criteria"];
	onChange: (value: GoalDocument["criteria"]["value"]) => void;
} & GameProps) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, criteria.key);

	if (!conf) {
		return <>ENOCONF {criteria.key}</>;
	}

	switch (conf.type) {
		case "NULLABLE_GRAPH":
		case "GRAPH":
			return <>Cannot set goals for graph metrics.</>;
		case "DECIMAL":
		case "INTEGER":
			return (
				<Form.Control
					className="mx-2"
					min={0}
					onChange={(e) => onChange(Number(e.target.value))}
					style={{ display: "inline", width: "unset" }}
					type="number"
					value={criteria.value}
				/>
			);
		case "ENUM":
			return (
				<Select
					inline
					setValue={(v) => onChange(Number(v))}
					value={criteria.value.toString()}
				>
					{conf.values
						.slice(conf.values.indexOf(conf.minimumRelevantValue))
						.map((e, i) => (
							<option
								key={i}
								value={i + conf.values.indexOf(conf.minimumRelevantValue)}
							>
								{e}
							</option>
						))}
				</Select>
			);
	}
}

function getBaseKeyValue(
	game: Parameters<typeof GetGameConfig>[0],
	key: GoalDocument["criteria"]["key"],
) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, key);

	if (!conf) {
		// SHOULD NEVER HAPPEN!
		return 0;
	}

	switch (conf.type) {
		case "ENUM":
			return conf.values.indexOf(conf.minimumRelevantValue);
		default:
			return 0;
	}
}
