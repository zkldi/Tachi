import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Icon from "#components/util/Icon";
import { type SetState } from "#types/react";
import { type GoalSubDataset } from "#types/tables";
import { NumericSOV } from "#util/sorts";
import { Button, Col, Modal, Row } from "react-bootstrap";

import { InnerQuestSectionGoal } from "./quests/Quest";

export default function DeleteGoalsModal({
	show,
	setShow,
	dataset,
	onDelete,
}: {
	dataset: GoalSubDataset;
	onDelete: (goalID: string) => void;
	setShow: SetState<boolean>;
	show: boolean;
}) {
	const deletableGoals = dataset.filter((e) => e.__related.parentQuests.length === 0);

	const sorted = dataset.slice(0).sort(NumericSOV((x) => x.__related.parentQuests.length));

	return (
		<Modal onHide={() => setShow(false)} show={show} size="xl">
			<Modal.Header closeButton>
				<Modal.Title>Delete Goals</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Row>
					{deletableGoals.length === 0 && (
						<Col className="text-center" xs={12}>
							You have no deletable goals.
						</Col>
					)}
					{sorted.map((e) => (
						<Col className="offset-lg-2 my-2" key={e.goalID} lg={8} xs={12}>
							<div className="d-flex">
								<div className="w-100">
									<InnerQuestSectionGoal
										dependencies={e.__related.parentQuests.map((e) => e.name)}
										goal={e.__related.goal}
									/>
								</div>
								<div className="ms-auto ps-4">
									{e.__related.parentQuests.length === 0 ? (
										<Button
											onClick={() => onDelete(e.goalID)}
											variant="outline-danger"
										>
											<Icon noPad type="trash" />
										</Button>
									) : (
										<QuickTooltip tooltipContent="This goal is depended on by quests you're subscribed to, and can't be deleted.">
											<Button disabled variant="outline-secondary">
												<Icon noPad type="times-circle" />
											</Button>
										</QuickTooltip>
									)}
								</div>
							</div>
						</Col>
					))}
				</Row>
			</Modal.Body>
		</Modal>
	);
}
