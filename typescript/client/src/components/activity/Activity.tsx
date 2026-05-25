import ClassBadge from "#components/game/ClassBadge";
import SessionRaiseBreakdown from "#components/sessions/SessionRaiseBreakdown";
import ScoreTable from "#components/tables/scores/ScoreTable";
import { InnerQuestSectionGoal } from "#components/targets/quests/Quest";
import ProfilePicture from "#components/user/ProfilePicture";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SupporterIcon from "#components/util/SupporterIcon";
import { UserContext } from "#context/UserContext";
import {
	type ActivityReturn,
	type RecordActivityReturn,
	type SessionReturns,
} from "#types/api-returns";
import { type UGPT } from "#types/react";
import { type ScoreDataset } from "#types/tables";
import {
	type ClumpedActivity,
	type ClumpedActivityClassAchievement,
	type ClumpedActivityGoalAchievement,
	type ClumpedActivityQuestAchievement,
	type ClumpedActivityScores,
	type ClumpedActivitySession,
} from "#types/tachi";
import { ClumpActivity, GetUsers } from "#util/activity";
import { APIFetchV1 } from "#util/api";
import { ONE_HOUR } from "#util/constants/time";
import { CreateScoreIDMap, CreateUserMap } from "#util/data";
import { NO_OP, TruncateString } from "#util/misc";
import { FormatTime, MillisToSince } from "#util/time";
import React, { useContext, useEffect, useState } from "react";
import { Button, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	FormatChart,
	FormatGame,
	GetGameConfig,
	GetScoreEnumConfs,
	type UserDocument,
} from "tachi-common";

function isActivityInteractiveTarget(el: HTMLElement) {
	return Boolean(el.closest("a, button, input, textarea, select, [role='button']"));
}

function activityUrlWithCursor(baseUrl: string, startTimeMs: number): string {
	const queryStart = baseUrl.indexOf("?");
	const path = queryStart === -1 ? baseUrl : baseUrl.slice(0, queryStart);
	const params = new URLSearchParams(queryStart === -1 ? "" : baseUrl.slice(queryStart + 1));

	params.set("startTime", String(startTimeMs));

	return `${path}?${params.toString()}`;
}

// Records activity for a group of users on a GPT. Also used for single users.
export default function Activity({
	url,
	handleNoActivity = (
		<Col className="text-center" xs={12}>
			We found no activity!
		</Col>
	),
}: {
	handleNoActivity?: React.ReactNode;
	url: string;
}) {
	const [clumped, setClumped] = useState<ClumpedActivity>([]);
	const [users, setUsers] = useState<Array<UserDocument>>([]);
	const [shouldShowGame, setShouldShowGame] = useState(false);
	const [exhausted, setExhausted] = useState(false);

	const { data, error } = useApiQuery<ActivityReturn | RecordActivityReturn>(url);

	useEffect(() => {
		if (!data) {
			setClumped([]);
			setUsers([]);
		} else {
			const newActivity = ClumpActivity(data);

			if (newActivity.filter((e) => e.type === "SESSION").length < 30) {
				setExhausted(true);
			}

			setClumped(newActivity);
			setUsers(GetUsers(data));

			// show game if this is { "iidx:SP": [], "iidx:DP": [] }...
			// to disambiguate
			setShouldShowGame(!("users" in data));
		}
	}, [data]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (clumped.length === 0) {
		return <>{handleNoActivity}</>;
	}

	return (
		<ActivityInner
			data={clumped}
			exhausted={exhausted}
			fetchMoreFrom={(start) => {
				APIFetchV1<ActivityReturn | RecordActivityReturn>(
					activityUrlWithCursor(url, start),
				).then((r) => {
					if (r.success) {
						const newActivity = ClumpActivity(r.body);

						if (newActivity.filter((e) => e.type === "SESSION").length < 30) {
							setExhausted(true);
						}

						setClumped([...clumped, ...newActivity]);
						setUsers([...users, ...GetUsers(r.body)]);
					}
				});
			}}
			shouldShowGame={shouldShowGame}
			users={users}
		/>
	);
}

function ActivityInner({
	data,
	users,
	fetchMoreFrom,
	shouldShowGame,
	exhausted,
}: {
	data: ClumpedActivity;
	exhausted: boolean;
	fetchMoreFrom: (start: number) => void;
	shouldShowGame: boolean;
	users: Array<UserDocument>;
}) {
	const userMap = CreateUserMap(users);

	return (
		<Col className="text-center" xs={12}>
			Tip: You can click on an event to learn more about it.
			<div className="timeline activity-timeline timeline-2 mt-4">
				<div className="timeline-bar"></div>
				{data.map((e, i) => {
					const user = userMap.get(e.type === "SCORES" ? e.scores[0]?.userID : e.userID);

					if (!user) {
						return <div key={i}>This user doesn't exist? Whoops.</div>;
					}

					switch (e.type) {
						case "SCORES":
							return (
								<ScoresActivity
									data={e}
									key={e.scores[0].scoreID}
									shouldShowGame={shouldShowGame}
									user={user}
								/>
							);
						case "SESSION":
							return (
								<SessionActivity
									data={e}
									key={e.sessionID}
									shouldShowGame={shouldShowGame}
									user={user}
								/>
							);
						case "CLASS_ACHIEVEMENT":
							return (
								<ClassAchievementActivity
									data={e}
									key={`${e.userID}${e.classValue}${e.timeAchieved}`}
									shouldShowGame={shouldShowGame}
									user={user}
								/>
							);
						case "GOAL_ACHIEVEMENTS":
							return (
								<GoalActivity
									data={e}
									key={i}
									shouldShowGame={shouldShowGame}
									user={user}
								/>
							);
						case "QUEST_ACHIEVEMENT":
							return (
								<QuestActivity
									data={e}
									key={i}
									shouldShowGame={shouldShowGame}
									user={user}
								/>
							);
					}
				})}
				<div className="timeline-item">
					<div className="timeline-badge bg-success"></div>
					<div className="timeline-content">
						{exhausted ? (
							<>No more activity. This is the end of the road!</>
						) : (
							<Button
								onClick={() => {
									let lastTimestamp;
									const lastThing = data.at(-1)!;

									switch (lastThing.type) {
										case "SCORES":
											lastTimestamp = lastThing.scores[0]?.timeAchieved;
											break;
										case "CLASS_ACHIEVEMENT":
											lastTimestamp = lastThing.timeAchieved;
											break;
										case "SESSION":
											lastTimestamp = lastThing.timeStarted;
											break;
										case "GOAL_ACHIEVEMENTS":
											lastTimestamp = lastThing.goals[0]?.timeAchieved;
											break;
										case "QUEST_ACHIEVEMENT":
											lastTimestamp = lastThing.sub.timeAchieved;
									}

									if (!lastTimestamp) {
										alert("Failed. What?");
										return;
									}

									fetchMoreFrom(lastTimestamp);
								}}
								variant="outline-primary"
							>
								Load More...
							</Button>
						)}
					</div>
				</div>
			</div>
		</Col>
	);
}

function ScoresActivity({
	data,
	user,
	shouldShowGame,
}: {
	data: ClumpedActivityScores;
	shouldShowGame: boolean;
	user: UserDocument;
}) {
	const game = data.scores[0].game;

	const prettyGame = shouldShowGame ? `${FormatGame(game)} ` : "";

	const [show, setShow] = useState(false);

	let subMessage;
	let mutedText: string | null | undefined;

	if (data.scores.length === 1) {
		const score0 = data.scores[0];

		subMessage = `a ${prettyGame}score on ${FormatChart(score0.__related.chart)}`;

		if (score0.comment) {
			mutedText = `"${score0.comment}"`;
		}
	} else {
		subMessage = `${data.scores.length} ${prettyGame}scores`;

		mutedText = TruncateString(
			data.scores.map((e) => FormatChart(e.__related.chart)).join(", "),
			100,
		);
	}

	const dataset: ScoreDataset = data.scores.map((e, i) => ({
		...e,
		__related: {
			...e.__related,
			index: i,
			user,
		},
	}));

	return (
		<div className="timeline-item timeline-hover my-4">
			<div className="timeline-badge bg-warning"></div>
			<div className="timeline-content flex-nowrap">
				<div
					className="timeline-content-inner activity-entry-toggle"
					onClick={(e) => {
						if (isActivityInteractiveTarget(e.target as HTMLElement)) {
							return;
						}

						setShow(!show);
					}}
				>
					<div className="timeline-content-title">
						<span className="me-2">
							<ProfilePicture size="sm" toGPT={{ game }} user={user} />
						</span>
						<Icon
							style={{
								fontSize: "0.75rem",
							}}
							type={`chevron-${show ? "down" : "right"}`}
						/>
						<span className="ms-2" style={{ fontSize: "1.15rem" }}>
							<UGPTLink game={game} reqUser={user} /> highlighted {subMessage}!
						</span>
						{mutedText && (
							<>
								<br />
								<Muted>{mutedText}</Muted>
							</>
						)}
					</div>

					<div className="timeline-content-timestamp">
						{MillisToSince(data.scores[0].timeAchieved ?? 0)}
						<br />
						<span className="text-body-secondary fst-italic text-end">
							{FormatTime(data.scores[0].timeAchieved ?? 0)}
						</span>
					</div>
				</div>

				{show && (
					<div className="activity-expand-body">
						<Divider />
						<ScoreTable dataset={dataset} game={game} noTopDisplayStr />
					</div>
				)}
			</div>
		</div>
	);
}

function GoalActivity({
	data,
	user,
	shouldShowGame,
}: {
	data: ClumpedActivityGoalAchievement;
	shouldShowGame: boolean;
	user: UserDocument;
}) {
	const game = data.goals[0].game;

	const prettyGame = shouldShowGame ? `${FormatGame(game)} ` : "";

	const [show, setShow] = useState(false);

	let subMessage;
	let mutedText: string | null | undefined;

	if (data.goals.length === 1) {
		const goal0 = data.goals[0];

		subMessage = `${goal0.__related.goal.name}${
			shouldShowGame ? ` in ${FormatGame(game)}` : ""
		}!`;
	} else {
		subMessage = `${data.goals.length} ${prettyGame}goals`;

		mutedText = TruncateString(data.goals.map((e) => e.__related.goal.name).join(", "), 100);
	}

	return (
		<div className="timeline-item timeline-hover my-4">
			<div className="timeline-badge bg-warning"></div>
			<div className="timeline-content">
				<div
					className="timeline-content-inner activity-entry-toggle"
					onClick={(e) => {
						if (isActivityInteractiveTarget(e.target as HTMLElement)) {
							return;
						}

						setShow(!show);
					}}
				>
					<div className="timeline-content-title">
						<span className="me-2">
							<ProfilePicture size="sm" toGPT={{ game }} user={user} />
						</span>
						<Icon
							style={{
								fontSize: "0.75rem",
							}}
							type={`chevron-${show ? "down" : "right"}`}
						/>
						<span className="ms-2" style={{ fontSize: "1.15rem" }}>
							<UGPTLink game={game} reqUser={user} /> achieved {subMessage}!
						</span>
						{mutedText && (
							<>
								<br />
								<Muted>{mutedText}</Muted>
							</>
						)}
					</div>

					<div className="timeline-content-timestamp">
						{MillisToSince(data.goals[0]?.timeAchieved ?? 0)}
						<br />
						<span className="text-body-secondary fst-italic text-end">
							{FormatTime(data.goals[0]?.timeAchieved ?? 0)}
						</span>
					</div>
				</div>

				{show && (
					<div className="activity-expand-body">
						<Divider />
						<div className="ps-4">
							{data.goals.map((e) => (
								<InnerQuestSectionGoal
									goal={e.__related.goal}
									goalSubOverride={e}
									key={e.goalID}
								/>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function QuestActivity({
	data,
	user,
	shouldShowGame,
}: {
	data: ClumpedActivityQuestAchievement;
	shouldShowGame: boolean;
	user: UserDocument;
}) {
	const game = data.quest.game;

	const prettyGame = shouldShowGame ? FormatGame(game) : "";

	return (
		<div className="timeline-item timeline-hover my-4">
			<div className="timeline-badge bg-warning"></div>
			<div className="timeline-content">
				<div className="timeline-content-inner">
					<div className="timeline-content-title">
						<span style={{ fontSize: "1.15rem" }}>
							<span className="me-2">
								<ProfilePicture size="sm" toGPT={{ game }} user={user} />
							</span>
							<UGPTLink game={game} reqUser={user} /> completed the{" "}
							<Link
								className="text-decoration-none"
								to={`/games/${game}/quests/${data.quest.questID}`}
							>
								{data.quest.name}
							</Link>{" "}
							quest{prettyGame && ` in ${prettyGame}`}!
						</span>
					</div>

					<div className="timeline-content-timestamp">
						{MillisToSince(data.sub.timeAchieved ?? 0)}
						<br />
						<span className="text-body-secondary fst-italic text-end">
							{FormatTime(data.sub.timeAchieved ?? 0)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function SessionActivity({
	data,
	user,
	shouldShowGame,
}: {
	data: ClumpedActivitySession;
	shouldShowGame: boolean;
	user: UserDocument;
}) {
	const [show, setShow] = useState(false);
	const { user: loggedInUser } = useContext(UserContext);

	const game = data.game;
	const prettyGame = shouldShowGame ? `${FormatGame(game)} ` : "";

	const isProbablyActive = Date.now() - data.timeEnded < ONE_HOUR;

	return (
		<div className="timeline-item timeline-hover">
			<div className={`timeline-badge bg-${data.highlight ? "warning" : "secondary"}`}></div>
			<div className="timeline-content">
				<div
					className="timeline-content-inner activity-entry-toggle"
					onClick={(e) => {
						if (isActivityInteractiveTarget(e.target as HTMLElement)) {
							return;
						}

						setShow(!show);
					}}
				>
					<div className="timeline-content-title">
						<span className="me-2">
							<ProfilePicture size="sm" toGPT={{ game }} user={user} />
						</span>
						<Icon
							style={{
								fontSize: "0.75rem",
							}}
							type={`chevron-${show ? "down" : "right"}`}
						/>
						<span
							className="ms-2"
							style={{
								fontWeight: isProbablyActive ? "bold" : undefined,
								fontSize: isProbablyActive ? "1.2rem" : undefined,
							}}
						>
							{/* worst string formatting ever */}
							<UGPTLink game={game} reqUser={user} />{" "}
							{isProbablyActive
								? user.id === loggedInUser?.id
									? "are having"
									: "is having"
								: "had"}{" "}
							a {prettyGame}
							session '{data.name}' with {data.scoreIDs.length}{" "}
							{data.scoreIDs.length === 1 ? "score" : "scores"}
							{data.highlight ? "!" : "."}
						</span>
						<br />
						{data.desc && data.desc !== "This session has no description." && (
							<span className="text-body-secondary">{data.desc}</span>
						)}
					</div>

					<div className="timeline-content-timestamp">
						{MillisToSince(data.timeStarted ?? 0)}
						<br />
						<span className="text-body-secondary fst-italic text-end">
							{FormatTime(data.timeStarted ?? 0)}
						</span>
					</div>
				</div>
				{show && (
					<div className="activity-expand-body">
						<SessionShower sessionID={data.sessionID} />
					</div>
				)}
			</div>
		</div>
	);
}

function SessionShower({ sessionID }: { sessionID: string }) {
	const { data, error } = useApiQuery<SessionReturns>(`/sessions/${sessionID}`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const scoreMap = CreateScoreIDMap(data.scores);

	const sessionGame = data.session.game;
	const gameConfig = GetGameConfig(sessionGame);

	const raises = data.scoreInfo.filter((e) => {
		const score = scoreMap.get(e.scoreID);

		// shouldnt happen, but whatever
		if (!score) {
			return false;
		}

		const enumMetrics = GetScoreEnumConfs(gameConfig);

		// for all enum metrics, check if this score beats the minimum relevant enum
		// and is a raise.
		for (const [metric, conf] of Object.entries(enumMetrics)) {
			if (!e.isNewScore && e.deltas[metric] <= 0) {
				continue;
			}

			if (
				// @ts-expect-error its gonna exist buddy
				score.scoreData.enumIndexes[metric] > conf.values.indexOf(conf.minimumRelevantValue)
			) {
				return true;
			}
		}

		return false;
	});

	if (raises.length === 0) {
		return (
			<Row className="mt-4">
				<div className="d-flex w-100 justify-content-center flex-column">
					<div className="mb-4">This session had no raises.</div>
					<div>
						<LinkButton
							to={`/u/${data.user.username}/games/${sessionGame}/sessions/${sessionID}`}
							variant="outline-primary"
						>
							View Full Session
						</LinkButton>
					</div>
				</div>
			</Row>
		);
	}

	return (
		<Row className="mt-4">
			<SessionRaiseBreakdown sessionData={data} setScores={NO_OP} />
			<Col xs={12}>
				<Divider />
			</Col>
			<div className="d-flex w-100 justify-content-center">
				<LinkButton
					to={`/u/${data.user.username}/games/${sessionGame}/sessions/${sessionID}`}
					variant="outline-primary"
				>
					View Full Session
				</LinkButton>
			</div>
		</Row>
	);
}

function ClassAchievementActivity({
	data,
	user,
	shouldShowGame,
}: {
	data: ClumpedActivityClassAchievement;
	shouldShowGame: boolean;
	user: UserDocument;
}) {
	return (
		<div className="timeline-item timeline-hover">
			<div className="timeline-badge bg-success"></div>
			<div className="timeline-content">
				<div className="timeline-content-inner">
					<div className="timeline-content-title">
						{(() => {
							const classGame = data.game;
							return (
								<>
									<span className="me-2">
										<ProfilePicture
											size="sm"
											toGPT={{ game: classGame }}
											user={user}
										/>
									</span>
									<UGPTLink game={classGame} reqUser={user} />{" "}
									{data.source === "manual" ? (
										<>
											manually set{" "}
											<ClassBadge
												classSet={data.classSet}
												classValue={data.classValue}
												game={classGame}
											/>
											{shouldShowGame && ` in ${FormatGame(classGame)}`}
											{data.classOldValue !== null && (
												<>
													{" "}
													(previously{" "}
													<ClassBadge
														classSet={data.classSet}
														classValue={data.classOldValue}
														game={classGame}
													/>
													)
												</>
											)}
										</>
									) : (
										<>
											achieved{" "}
											<ClassBadge
												classSet={data.classSet}
												classValue={data.classValue}
												game={classGame}
											/>
											{shouldShowGame && ` in ${FormatGame(classGame)}`}!
											{data.classOldValue !== null && (
												<>
													{" "}
													(Raised from{" "}
													<ClassBadge
														classSet={data.classSet}
														classValue={data.classOldValue}
														game={classGame}
													/>
													)
												</>
											)}
										</>
									)}
								</>
							);
						})()}
					</div>

					<div className="timeline-content-timestamp">
						{MillisToSince(data.timeAchieved)}
						<br />
						<span className="text-body-secondary fst-italic text-end">
							{FormatTime(data.timeAchieved)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function UGPTLink({ reqUser, game }: UGPT) {
	const { user } = useContext(UserContext);

	return (
		<Link className="text-decoration-none fw-bold" to={`/u/${reqUser.username}/games/${game}`}>
			{user?.id === reqUser.id ? "You" : reqUser.username}
			{reqUser?.isSupporter ? (
				<>
					{" "}
					<SupporterIcon />
				</>
			) : (
				<></>
			)}
		</Link>
	);
}
