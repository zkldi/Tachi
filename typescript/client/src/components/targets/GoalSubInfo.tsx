import Divider from "#components/util/Divider";
import Select from "#components/util/Select";
import { type GameProps } from "#types/react";
import { type GoalSubDataset } from "#types/tables";
import { NumericSOV } from "#util/sorts";
import React, { useMemo, useState } from "react";
import { Col } from "react-bootstrap";
import { type GoalDocument } from "tachi-common";

import { InnerQuestSectionGoal } from "./quests/Quest";

export default function GoalSubInfo({
	dataset,
	game,
	onEditGoal,
}: { dataset: GoalSubDataset; onEditGoal?: (goal: GoalDocument) => void } & GameProps) {
	const [show, setShow] = useState<"achieved" | "all" | "unachieved">("all");

	const { directGoals, folderGoals } = useMemo(() => {
		let baseDataset = dataset.slice(0).sort(
			NumericSOV((x) => {
				// sink achieved things below goals in progress
				if (x.achieved) {
					return -100;
				}

				// sink no-progress slightly above that
				if (x.progress === null) {
					return -99;
				}

				// since this is always ostensibly positive, the magic numbers -99 and
				// -100 should be fine.
				return x.progress / x.outOf;
			}, true),
		);

		switch (show) {
			case "all":
				break;
			case "achieved":
				baseDataset = baseDataset.filter((e) => e.achieved === true);
				break;
			case "unachieved":
				baseDataset = baseDataset.filter((e) => e.achieved === false);
				break;
		}

		return {
			directGoals: baseDataset.filter(
				(e) =>
					e.__related.goal.charts.type === "single" ||
					e.__related.goal.charts.type === "multi",
			),
			folderGoals: baseDataset.filter((e) => e.__related.goal.charts.type === "folder"),
		};
	}, [show]);

	return (
		<>
			<Col xs={12}>
				<div className="ps-6">
					<div className="d-flex w-100 justify-content-start">
						<Select name="What goals should we show?" setValue={setShow} value={show}>
							<option value="all">All</option>
							<option value="unachieved">Unachieved</option>
							<option value="achieved">Achieved</option>
						</Select>
					</div>
				</div>
				<Divider />
			</Col>
			<Col xs={12}>
				{directGoals.length !== 0 && (
					<div className="ps-6">
						{directGoals.map((e, i) => (
							<div className="pb-2 text-start" key={i}>
								<InnerQuestSectionGoal
									dependencies={e.__related.parentQuests.map((e) => e.name)}
									goal={e.__related.goal}
									onEdit={
										e.wasAssignedStandalone && onEditGoal
											? () => onEditGoal(e.__related.goal)
											: undefined
									}
								/>
							</div>
						))}
					</div>
				)}
				{folderGoals.length !== 0 && directGoals.length !== 0 && <Divider />}
				{folderGoals.length !== 0 && (
					<div className="ps-6">
						{folderGoals.map((e, i) => (
							<div className="pb-2 text-start" key={i}>
								<InnerQuestSectionGoal
									dependencies={e.__related.parentQuests.map((e) => e.name)}
									goal={e.__related.goal}
									onEdit={
										e.wasAssignedStandalone && onEditGoal
											? () => onEditGoal(e.__related.goal)
											: undefined
									}
								/>
							</div>
						))}
					</div>
				)}
				{folderGoals.length === 0 && directGoals.length === 0 && (
					<div className="text-center">You've got no goals here!</div>
				)}
			</Col>
		</>
	);
}
