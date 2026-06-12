import Activity from "#components/activity/Activity";
import DashboardActivity from "#components/dashboard/DashboardActivity";
import { DashboardHeader } from "#components/dashboard/DashboardHeader";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import SessionCalendar from "#components/sessions/SessionCalendar";
import SessionCard from "#components/sessions/SessionCard";
import UserGameProfiles from "#components/user/UserGameProfiles";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import GoalLink from "#components/util/GoalLink";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { WindowContext } from "#context/WindowContext";
import { TachiConfig } from "#lib/config";
import { type UserRecentSummary } from "#types/api-returns";
import { CreateGoalMap } from "#util/data";
import { RFA } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import { heySplashes } from "#util/splashes";
import React, { useContext, useMemo } from "react";
import Alert from "react-bootstrap/Alert";
import Stack from "react-bootstrap/Stack";
import { Link, Route, Switch } from "react-router-dom";
import { type UserDocument } from "tachi-common";

import SupportBanner from "./misc/SupportBanner";

export function DashboardPage() {
	const { settings } = useContext(UserSettingsContext);

	useSetSubheader("Home", [settings]);

	const { user } = useContext(UserContext);

	if (!user) {
		return <DashboardNotLoggedIn />;
	}

	return <DashboardLoggedIn user={user} />;
}

function DashboardLoggedIn({ user }: { user: UserDocument }) {
	const splash = useMemo(() => RFA(heySplashes), []);

	return (
		<div>
			<SupportBanner user={user} />
			<span className="display-4">
				{splash}, {user.username}.
			</span>
			<div className="card my-4">
				<DashboardHeader />
			</div>
			<Divider />
			<RecentInfo user={user} />
			<Switch>
				<Route exact path="/">
					<DashboardActivity user={user} />
				</Route>
				<Route exact path="/calendar">
					<SessionCalendar
						shouldDifferentiateGames
						url={`/users/${user.id}/sessions/calendar`}
						user={user}
					/>
				</Route>
				<Route exact path="/profiles">
					<UserGameProfiles />
				</Route>
				<Route exact path="/global-activity">
					<Activity url="/ublock-blocks-this" />
				</Route>
			</Switch>
		</div>
	);
}

function RecentInfo({ user }: { user: UserDocument }) {
	const { data, error } = useApiQuery<UserRecentSummary>(`/users/${user.id}/recent-summary`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const folderInfoMap = new Map();
	for (const folderInfo of data.recentFolderStats) {
		folderInfoMap.set(folderInfo.slug, folderInfo);
	}

	const goalMap = CreateGoalMap(data.recentGoals);

	return (
		<>
			{data.recentSessions.length !== 0 && (
				<>
					<Alert variant="primary">
						<div className="text-center">
							<h1>Today's Summary</h1>
							You've gotten <b>{data.recentPlaycount}</b> new score
							{data.recentPlaycount !== 1 ? "s" : ""} today!
						</div>
					</Alert>
					<hr />
					<div className="text-center">
						<h1>New Sessions</h1>
						You've had <b>{data.recentSessions.length}</b> session
						{data.recentSessions.length !== 1 ? "s" : ""} today!
					</div>
					<hr />
					{data.recentSessions.sort(NumericSOV((x) => x.timeEnded, true)).map((e) => (
						<>
							<SessionCard key={e.sessionID} sessionID={e.sessionID} />
							<hr />
						</>
					))}
				</>
			)}
			{data.recentAchievedGoals.length !== 0 && (
				<>
					<Alert variant="warning">
						<div className="text-center">
							<h1>
								{RFA([
									"Sweet!",
									"Nice!",
									"Lookin' good!",
									"Good Stuff!",
									"owo",
									"Cool!",
									"Awesome!",
									"Epic!",
								])}
							</h1>
							You've achieved <b>{data.recentAchievedGoals.length}</b> new goal
							{data.recentAchievedGoals.length !== 1 ? "s" : ""} today!
						</div>
						<hr />
						<div>
							<ul>
								{data.recentAchievedGoals.map((e) => {
									const goal = goalMap.get(e.goalID);

									if (!goal) {
										return (
											<span key={e.goalID}>
												whoops, couldn't find this goal.
											</span>
										);
									}

									return (
										<li key={e.goalID}>
											<GoalLink goal={goal} />
										</li>
									);
								})}
							</ul>
						</div>
					</Alert>
					<Divider />
				</>
			)}
			{/* {data.recentFolders.length !== 0 && (
				<>
					<h1>Here's some folders you checked out recently.</h1>
					<Divider />
					<div className="row">
						{data.recentFolders.map((e) => (
							<FolderInfoComponent
								key={e.folderID}
								folder={e}
								game={e.game}
								playtype={e.playtype}
								reqUser={user}
								folderStats={folderInfoMap.get(e.folderID)!}
							/>
						))}
					</div>
					<Divider />
				</>
			)} */}
		</>
	);
}

function DashboardNotLoggedIn() {
	const {
		breakpoint: { isMd },
	} = useContext(WindowContext);
	return (
		<Stack className="enable-rfs" gap={4} style={{ fontSize: "16px" }}>
			<div>
				<h1 className="fw-bold">Welcome to {TachiConfig.NAME}!</h1>
				<h4 className="fs-3">
					Looks like you're not logged in. If you've got an account,{" "}
					<Link className="link-primary" to="/login">
						Login!
					</Link>
				</h4>
			</div>
			<Divider />
			<div>
				<h1>I'm New Around Here, What is this?</h1>
				<p>
					<b>{TachiConfig.NAME}</b> is a Rhythm Game Score Tracker. That means we...
				</p>
			</div>
			<Divider className="mb-2" />
			<FeatureContainer
				description={`${TachiConfig.NAME} supports a bunch of your favourite games, and integrates with many existing services to make sure no score is lost to the void. Furthermore, it's backed by an Open-Source API, so your scores are always available!`}
				tagline="Track Your Scores."
			/>
			<FeatureContainer
				description={`${TachiConfig.NAME} analyses your scores for you, breaking them down into all the statistics you'll ever need. No more spreadsheets!`}
				tagline="Analyse Your Scores."
			/>
			<FeatureContainer
				description={`${TachiConfig.NAME} implements the features rhythm gamers already talk about. Break your scores down into sessions, Showcase your best metrics on your profile, study your progress on folders - it's all there, and done for you!`}
				tagline="Provide Cool Features."
			/>
			<Divider />

			<Stack className="mx-auto gap-4 gap-md-8" direction={isMd ? "horizontal" : "vertical"}>
				<h1 className="fw-bold p-0 m-0 text-center">Interested?</h1>
				<div className="vr d-none d-md-block" />
				<hr className="m-0 mb-2 d-md-none" />
				<LinkButton className="align-self-center" size="lg" to="/register">
					Create an account for <b>free</b>!
				</LinkButton>
			</Stack>
			<Divider />
			<div className="text-center">
				Nosey? Here's what our users are up to.
				<div style={{ fontSize: "1rem" }}>
					<Activity url="/ublock-blocks-this" />
				</div>
			</div>
		</Stack>
	);
}

function FeatureContainer({ tagline, description }: { description: string; tagline: string }) {
	return (
		<div style={{ maxWidth: "790px" }}>
			<h1 className="display-3 fw-light">{tagline}</h1>
			<p>{description}</p>
		</div>
	);
}
