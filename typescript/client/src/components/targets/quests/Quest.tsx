import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Card from "#components/layout/page/Card";
import QuestProgressBar from "#components/targets/QuestProgressBar";
import Divider from "#components/util/Divider";
import GoalLink from "#components/util/GoalLink";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import { TargetsContext } from "#context/TargetsContext";
import { UserContext } from "#context/UserContext";
import { type GameProps } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { GetGoalIDsFromQuest } from "#util/data";
import { HumanisedJoinArray } from "#util/misc";
import { FormatTime } from "#util/time";
import React, { useContext, useState } from "react";
import { Badge, Button } from "react-bootstrap";
import {
	FormatGame,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type QuestDocument,
	type QuestSection,
} from "tachi-common";

export default function Quest({
	quest,
	goals,
	collapsible = false,
}: {
	collapsible?: boolean;
	goals: Map<string, GoalDocument>;
	quest: QuestDocument;
}) {
	const { user } = useContext(UserContext);
	const { questSubs, goalSubs, reloadTargets } = useContext(TargetsContext);
	const [subscribing, setSubscribing] = useState(false);

	const questSub = questSubs.get(quest.questID);
	const v3Game = quest.game;

	const allGoalIDs = GetGoalIDsFromQuest(quest);
	const totalGoals = allGoalIDs.length;
	const achievedGoals = allGoalIDs.filter((id) => goalSubs.get(id)?.achieved).length;
	const progressPct = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

	const [show, setShow] = useState(!collapsible);

	const subscribeBtn =
		user &&
		(questSub ? (
			<Button
				disabled={subscribing}
				onClick={async () => {
					setSubscribing(true);
					await APIFetchV1(
						`/users/${user.id}/games/${v3Game}/targets/quests/${quest.questID}`,
						{ method: "DELETE" },
						true,
						true,
					);
					await reloadTargets();
					setSubscribing(false);
				}}
				size="sm"
				variant="outline-danger"
			>
				{subscribing ? (
					"Unsubscribing…"
				) : (
					<>
						<Icon type="trash" /> Unsubscribe
					</>
				)}
			</Button>
		) : (
			<Button
				disabled={subscribing}
				onClick={async () => {
					setSubscribing(true);
					await APIFetchV1(
						`/users/${user.id}/games/${v3Game}/targets/quests/${quest.questID}`,
						{ method: "PUT" },
						true,
						true,
					);
					await reloadTargets();
					setSubscribing(false);
				}}
				size="sm"
				variant="success"
			>
				{subscribing ? (
					"Subscribing…"
				) : (
					<>
						<Icon type="scroll" /> Subscribe
					</>
				)}
			</Button>
		));

	return (
		<Card
			header={
				<div className="w-100">
					<div className="d-flex align-items-start justify-content-between gap-3">
						<div className="flex-grow-1 min-w-0">
							<h4 className="mb-1">{quest.name}</h4>
							<p className="text-body-secondary mb-1 small">{quest.desc}</p>
							<Muted>{FormatGame(quest.game)}</Muted>
						</div>
						<div className="flex-shrink-0">{subscribeBtn}</div>
					</div>

					{/* Overall progress bar — visible when subscribed */}
					{questSub && (
						<div className="mt-3">
							{questSub.achieved ? (
								<Badge bg="success" className="py-2 px-3">
									<Icon type="check" /> Quest Complete!
								</Badge>
							) : (
								<>
									<div className="d-flex justify-content-between align-items-baseline gap-2 small text-body-secondary mb-1">
										<span className="fw-medium text-body">Progress</span>
										<span className="text-end text-nowrap">
											<span className="fw-semibold tabular-nums text-body">
												{progressPct}%
											</span>
											<span className="mx-1 text-body-secondary">·</span>
											{achievedGoals} / {totalGoals} goals
										</span>
									</div>
									<QuestProgressBar
										aria-label={`Quest progress: ${progressPct} percent, ${achievedGoals} of ${totalGoals} goals complete`}
										percent={progressPct}
									/>
								</>
							)}
						</div>
					)}
				</div>
			}
		>
			{show &&
				quest.questData.map((section, i) => (
					<React.Fragment key={i}>
						<QuestSectionComponent game={quest.game} goals={goals} section={section} />
						{i < quest.questData.length - 1 && <Divider />}
					</React.Fragment>
				))}

			{collapsible && (
				<div
					className="d-flex w-100 justify-content-center text-hover-white mt-2"
					onClick={() => setShow(!show)}
					style={{ cursor: "pointer" }}
				>
					<Icon type={`chevron-${show ? "up" : "down"}`} />
				</div>
			)}
		</Card>
	);
}

function QuestSectionComponent({
	section,
	game,
	goals,
}: {
	goals: Map<string, GoalDocument>;
	section: QuestSection;
} & GameProps) {
	const { goalSubs } = useContext(TargetsContext);

	const achievedInSection = section.goals.filter((g) => goalSubs.get(g.goalID)?.achieved).length;
	const totalInSection = section.goals.length;

	return (
		<div className="mb-2">
			{/* Section header with mini-progress badge */}
			<div className="d-flex align-items-center justify-content-between mb-2">
				<h6 className="mb-0 fw-semibold text-body-secondary text-uppercase small letter-spacing-wide">
					{section.title}
				</h6>
				{totalInSection > 0 && (
					<Badge
						bg={achievedInSection === totalInSection ? "success" : "secondary"}
						className="ms-2"
					>
						{achievedInSection} / {totalInSection}
					</Badge>
				)}
			</div>
			{section.desc && <p className="text-body-secondary small mb-2">{section.desc}</p>}
			<hr className="mt-0 mb-3 opacity-10" />

			{section.goals.length === 0 ? (
				<Muted>No Goals…</Muted>
			) : (
				<div className="d-flex flex-column gap-2">
					{section.goals.map((goalRef, i) => {
						const goal = goals.get(goalRef.goalID);

						if (!goal) {
							return (
								<div className="text-danger small" key={i}>
									Unknown goal '{goalRef.goalID}'
								</div>
							);
						}

						return <GoalCard game={game} goal={goal} key={i} note={goalRef.note} />;
					})}
				</div>
			)}
		</div>
	);
}

/** A richer goal card showing progress, chart context, and an optional edit button. */
function GoalCard({
	goal,
	note,
	game: _game,
	onEdit,
}: {
	goal: GoalDocument;
	note?: string;
	onEdit?: () => void;
} & GameProps) {
	const { goalSubs } = useContext(TargetsContext);
	const goalSub = goalSubs.get(goal.goalID);

	const isAchieved = goalSub?.achieved ?? false;
	const inProgress = goalSub && !isAchieved && goalSub.progress !== null && goalSub.progress > 0;

	return (
		<div
			className={`d-flex align-items-start gap-3 rounded p-2 ${
				isAchieved
					? "bg-success bg-opacity-10"
					: inProgress
						? "bg-warning bg-opacity-10"
						: ""
			}`}
		>
			{/* Status icon */}
			<div className="flex-shrink-0 pt-1">
				{goalSub ? (
					<QuickTooltip
						tooltipContent={
							isAchieved
								? `Achieved on ${FormatTime(goalSub.timeAchieved ?? 0)}`
								: goalSub.lastInteraction
									? `Last raised on ${FormatTime(goalSub.lastInteraction)}`
									: "Never attempted"
						}
					>
						<div>
							{isAchieved ? (
								<Icon colour="success" regular type="check-square" />
							) : inProgress ? (
								<Icon colour="warning" regular type="square" />
							) : (
								<Icon colour="secondary" regular type="square" />
							)}
						</div>
					</QuickTooltip>
				) : (
					<Icon style={{ fontSize: "0.5rem", verticalAlign: "middle" }} type="circle" />
				)}
			</div>

			{/* Goal name + note */}
			<div className="flex-grow-1 min-w-0">
				<div className="d-flex align-items-center gap-2">
					<GoalLink goal={goal} />
					{onEdit && (
						<button
							className="btn btn-link btn-sm p-0 text-body-secondary"
							onClick={onEdit}
							title="Update this goal"
							type="button"
						>
							<Icon type="pencil-alt" />
						</button>
					)}
				</div>
				{note && <span className="text-body-secondary small">{note}</span>}
			</div>

			{/* Progress chip — only shown when subscribed and not achieved */}
			{goalSub && !isAchieved && (
				<div className="flex-shrink-0 text-end small">
					<span className={inProgress ? "text-warning" : "text-body-secondary"}>
						{goalSub.progressHuman}
					</span>
					<Muted> / {goalSub.outOfHuman}</Muted>
				</div>
			)}
		</div>
	);
}

export function InnerQuestSectionGoal({
	goal,
	note,
	dependencies,
	goalSubOverride,
	onEdit,
}: {
	dependencies?: string[];
	goal: GoalDocument;
	goalSubOverride?: GoalSubscriptionDocument;
	note?: string;
	onEdit?: () => void;
}) {
	const { goalSubs } = useContext(TargetsContext);

	const goalSub = goalSubOverride ?? goalSubs.get(goal.goalID);

	if (!goalSub) {
		return (
			<>
				<div className="w-100 d-flex align-items-center gap-2">
					<Icon style={{ verticalAlign: "middle", fontSize: "0.4rem" }} type="circle" />
					<GoalLink goal={goal} />
					{onEdit && (
						<button
							className="btn btn-link btn-sm p-0 text-body-secondary"
							onClick={onEdit}
							title="Update this goal"
							type="button"
						>
							<Icon type="pencil-alt" />
						</button>
					)}
				</div>
				{note && <Muted>{note}</Muted>}
			</>
		);
	}

	const isAchieved = goalSub.achieved;
	const inProgress = !isAchieved && goalSub.progress !== null && goalSub.progress > 0;

	return (
		<>
			<div className="w-100 d-flex align-items-center gap-2">
				<QuickTooltip
					tooltipContent={
						isAchieved
							? `Achieved on ${FormatTime(goalSub.timeAchieved)}`
							: goalSub.lastInteraction
								? `Last raised on ${FormatTime(goalSub.lastInteraction)}`
								: "Never attempted"
					}
				>
					<div>
						{isAchieved ? (
							<Icon
								colour="success"
								regular
								style={{ verticalAlign: "middle" }}
								type="check-square"
							/>
						) : inProgress ? (
							<Icon
								colour="warning"
								regular
								style={{ verticalAlign: "middle" }}
								type="square"
							/>
						) : (
							<Icon
								colour="danger"
								regular
								style={{ verticalAlign: "middle" }}
								type="square"
							/>
						)}
					</div>
				</QuickTooltip>

				<GoalLink goal={goal} />

				{onEdit && (
					<button
						className="btn btn-link btn-sm p-0 text-body-secondary"
						onClick={onEdit}
						title="Update this goal"
						type="button"
					>
						<Icon type="pencil-alt" />
					</button>
				)}

				{!isAchieved && (
					<div className="ms-auto text-end small">
						<span className={inProgress ? "text-warning" : "text-danger"}>
							{goalSub.progressHuman}
						</span>
						<Muted> / {goalSub.outOfHuman}</Muted>
					</div>
				)}
			</div>
			<div>
				{note && <Muted>{note}</Muted>}
				{dependencies && (
					<FormatGoalDependencies
						deps={dependencies}
						isStandalone={goalSub.wasAssignedStandalone}
					/>
				)}
			</div>
		</>
	);
}

function FormatGoalDependencies({ deps, isStandalone }: { deps: string[]; isStandalone: boolean }) {
	let str;

	if (isStandalone && deps.length === 0) {
		str = "You set this goal directly.";
	} else if (isStandalone && deps.length > 0) {
		str = `You set this goal, but it's also in ${HumanisedJoinArray(deps, "and")}.`;
	} else if (deps.length === 0) {
		return null;
	} else {
		str = `From ${HumanisedJoinArray(deps, "and")}.`;
	}

	return <Muted>{str}</Muted>;
}
