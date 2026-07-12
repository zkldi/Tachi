import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Card from "#components/layout/page/Card";
import QuestProgressBar from "#components/targets/QuestProgressBar";
import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import Muted from "#components/util/Muted";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { TargetsContext } from "#context/TargetsContext";
import { APIFetchV1 } from "#util/api";
import { GetGoalIDsFromQuest } from "#util/data";
import { FormatTime } from "#util/time";
import { useContext, useState } from "react";
import { Badge, Button, Collapse } from "react-bootstrap";
import { type QuestDocument, type QuestlineDocument } from "tachi-common";

export default function Questline({
	questline,
	quests,
}: {
	questline: QuestlineDocument;
	quests?: Map<string, QuestDocument>;
}) {
	const v3Game = questline.game;
	const { questSubs } = useContext(TargetsContext);

	const totalQuests = questline.quests.length;
	const achievedQuests = questline.quests.filter((id) => questSubs.get(id)?.achieved).length;
	const progressPct = totalQuests > 0 ? Math.round((achievedQuests / totalQuests) * 100) : 0;
	const anySubscribed = questline.quests.some((id) => questSubs.has(id));

	return (
		<Card
			header={
				<div className="w-100">
					<div className="d-flex align-items-start justify-content-between gap-3">
						<div>
							<h4 className="mb-1">{questline.name}</h4>
							<Muted>
								{totalQuests} {totalQuests === 1 ? "Quest" : "Quests"}
							</Muted>
						</div>
						{!quests && (
							<div className="flex-shrink-0">
								<LinkButton
									size="sm"
									to={`/games/${v3Game}/questlines/${questline.questlineID}`}
								>
									View All Quests
								</LinkButton>
							</div>
						)}
					</div>

					<p className="mt-2 mb-0 text-body-secondary small">{questline.desc}</p>

					{/* Overall progress bar — shown when the user has subscribed to any quest */}
					{anySubscribed && (
						<div className="mt-3">
							{achievedQuests === totalQuests && totalQuests > 0 ? (
								<Badge bg="success" className="py-2 px-3">
									<Icon type="check" /> Questline Complete!
								</Badge>
							) : (
								<>
									<div className="d-flex justify-content-between align-items-baseline gap-2 small text-body-secondary mb-1">
										<span className="fw-medium text-body">
											Questline progress
										</span>
										<span className="text-end text-nowrap">
											<span className="fw-semibold tabular-nums text-body">
												{progressPct}%
											</span>
											<span className="mx-1 text-body-secondary">·</span>
											{achievedQuests} / {totalQuests} quests
										</span>
									</div>
									<QuestProgressBar
										aria-label={`Questline progress: ${progressPct} percent, ${achievedQuests} of ${totalQuests} quests complete`}
										percent={progressPct}
									/>
								</>
							)}
						</div>
					)}
				</div>
			}
		>
			{/* Timeline — shown on questline detail page when quests map is provided */}
			{quests && (
				<div className="questline-timeline ps-2">
					{questline.quests.map((questID, idx) => {
						const quest = quests.get(questID);

						if (!quest) {
							return null;
						}

						return (
							<QuestTimelineNode
								isLast={idx === questline.quests.length - 1}
								key={questID}
								number={idx + 1}
								quest={quest}
							/>
						);
					})}
				</div>
			)}
		</Card>
	);
}

function QuestTimelineNode({
	quest,
	number,
	isLast,
}: {
	isLast: boolean;
	number: number;
	quest: QuestDocument;
}) {
	const { questSubs } = useContext(TargetsContext);
	const questSub = questSubs.get(quest.questID);
	const [open, setOpen] = useState(false);

	const isAchieved = questSub?.achieved ?? false;
	const goalTotal = GetGoalIDsFromQuest(quest).length;

	const nodeColour = isAchieved
		? "success"
		: questSub && questSub.progress > 0
			? "warning"
			: "secondary";

	return (
		<div className={`d-flex gap-3 ${isLast ? "" : "mb-0"}`}>
			{/* Left: connector line + node circle */}
			<div className="d-flex flex-column align-items-center" style={{ width: "32px" }}>
				<div
					className={`rounded-circle d-flex align-items-center justify-content-center fw-bold text-white bg-${nodeColour}`}
					style={{ width: "32px", height: "32px", minWidth: "32px", fontSize: "0.8rem" }}
				>
					{isAchieved ? <Icon type="check" /> : number}
				</div>
				{!isLast && (
					<div
						className="flex-grow-1 mt-1"
						style={{
							width: "2px",
							background: "var(--bs-border-color)",
							minHeight: "16px",
						}}
					/>
				)}
			</div>

			{/* Right: quest info */}
			<div className={`flex-grow-1 pb-3 ${isLast ? "" : ""}`}>
				<button
					className="btn btn-link p-0 text-start text-decoration-none w-100 d-flex align-items-center gap-2"
					onClick={() => setOpen((o) => !o)}
					type="button"
				>
					<span className="fw-semibold">{quest.name}</span>
					<Icon type={`chevron-${open ? "up" : "down"}`} />
					{questSub && !isAchieved && (
						<Badge bg="secondary" className="ms-auto">
							{questSub.progress} / {goalTotal}
						</Badge>
					)}
					{isAchieved && (
						<Badge bg="success" className="ms-auto">
							<Icon type="check" /> Done
						</Badge>
					)}
				</button>

				<Collapse in={open}>
					<div className="mt-2">
						<p className="text-body-secondary small mb-2">{quest.desc}</p>
						<div className="d-flex align-items-center gap-2 flex-wrap">
							<Muted>{goalTotal} goals</Muted>
							<QuestSubscribeButton quest={quest} />
							<a className="small" href={`#${quest.questID}`}>
								View details ↓
							</a>
						</div>
					</div>
				</Collapse>
			</div>
		</div>
	);
}

function QuestSubscribeButton({ quest }: { quest: QuestDocument }) {
	const { settings } = useLoggedInUserGameSettings();
	const { questSubs, reloadTargets } = useContext(TargetsContext);
	const [loading, setLoading] = useState(false);

	const v3Game = quest.game;
	const questSub = questSubs.get(quest.questID);

	if (!settings) {
		return null;
	}

	if (questSub) {
		return (
			<QuickTooltip
				tooltipContent={
					questSub.achieved
						? `Achieved on ${FormatTime(questSub.timeAchieved ?? 0)}`
						: questSub.lastInteraction
							? `Last raised on ${FormatTime(questSub.lastInteraction ?? 0)}`
							: "Freshly assigned!"
				}
			>
				<Button
					disabled={loading}
					onClick={async () => {
						setLoading(true);
						await APIFetchV1(
							`/users/${settings.userID}/games/${v3Game}/targets/quests/${quest.questID}`,
							{ method: "DELETE" },
							true,
							true,
						);
						await reloadTargets();
						setLoading(false);
					}}
					size="sm"
					variant="outline-danger"
				>
					{loading ? (
						"…"
					) : (
						<>
							<Icon type="trash" /> Unsubscribe
						</>
					)}
				</Button>
			</QuickTooltip>
		);
	}

	return (
		<Button
			disabled={loading}
			onClick={async () => {
				setLoading(true);
				await APIFetchV1(
					`/users/${settings.userID}/games/${v3Game}/targets/quests/${quest.questID}`,
					{ method: "PUT" },
					true,
					true,
				);
				await reloadTargets();
				setLoading(false);
			}}
			size="sm"
			variant="outline-success"
		>
			{loading ? (
				"…"
			) : (
				<>
					<Icon type="scroll" /> Subscribe
				</>
			)}
		</Button>
	);
}

/** Legacy component kept for compatibility — now delegates to QuestTimelineNode via Questline. */
export function InnerQuestInfo({ quest }: { quest: QuestDocument }) {
	const { questSubs } = useContext(TargetsContext);
	const questSub = questSubs.get(quest.questID);
	const v3Game = quest.game;
	const goalTotal = GetGoalIDsFromQuest(quest).length;

	return (
		<div className="w-100 d-flex align-items-center gap-2">
			{questSub ? (
				<QuickTooltip
					tooltipContent={
						questSub.achieved
							? `Achieved on ${FormatTime(questSub.timeAchieved ?? 0)}`
							: questSub.lastInteraction
								? `Last raised on ${FormatTime(questSub.lastInteraction ?? 0)}`
								: "Freshly assigned!"
					}
				>
					<div>
						{questSub.achieved ? (
							<Icon
								colour="success"
								regular
								style={{ verticalAlign: "middle" }}
								type="check-square"
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
			) : (
				<Icon style={{ fontSize: "0.4rem", verticalAlign: "middle" }} type="circle" />
			)}

			<a className="text-decoration-none" href={`#${quest.questID}`}>
				{quest.name}
			</a>

			{questSub && !questSub.achieved && (
				<div className="ms-auto text-danger small">
					<span>{questSub.progress}</span>
					<Muted> / {goalTotal}</Muted>
				</div>
			)}
		</div>
	);
}
