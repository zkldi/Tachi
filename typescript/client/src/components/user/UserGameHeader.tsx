import { GetGameUtilsName } from "#components/game-utils/GameUtils";
import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Navbar from "#components/nav/Navbar";
import MiniTable from "#components/tables/components/MiniTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import FollowUserButton from "#components/util/FollowUserButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { TachiConfig } from "#lib/config";
import { type UserGameStatsReturn } from "#types/api-returns";
import { APIFetchV1 } from "#util/api";
import { HumaniseError } from "#util/humanise-error";
import { FormatDurationHours, MillisToSince } from "#util/time";
import { SendErrorToast, SendSuccessToast } from "#util/toaster";
import { useContext } from "react";
import { Button } from "react-bootstrap";
import { type integer, type UserDocument, type V3Game } from "tachi-common";

import ProfileBadges from "./ProfileBadges";
import ProfilePicture from "./ProfilePicture";
import UserGameRankingData from "./UserGameRankingData";
import UserGameRatingsTable from "./UserGameStatsOverview";

export function UserGameHeaderBody({
	reqUser,
	game,
	stats,
}: {
	game: V3Game;
	reqUser: UserDocument;
	stats: UserGameStatsReturn;
}) {
	const { settings, setSettings } = useLoggedInUserGameSettings();
	const { settings: userSettings } = useContext(UserSettingsContext);

	const { data: MAX_RIVALS, error } = useApiQuery<integer>("/config/max-rivals");

	if (error) {
		return <ApiError error={error} />;
	}

	if (!MAX_RIVALS) {
		return <Loading />;
	}

	return (
		<>
			<div className="col-12 col-lg-3">
				<div className="d-flex justify-content-center mb-3">
					<ProfilePicture user={reqUser} />
				</div>
				<div className="d-flex align-items-center" style={{ flexDirection: "column" }}>
					<ProfileBadges user={reqUser} />
				</div>
				<div className="d-block d-lg-none">
					<Divider className="mt-4 mb-4" />
				</div>
			</div>

			<div className="col-12 col-md-6 col-lg-3">
				<MiniTable className="table-sm text-center" colSpan={2} headers={["Player Info"]}>
					<tr>
						<td>Scores</td>
						<td>{stats.totalScores}</td>
					</tr>
					<tr>
						<td>Last Played</td>
						<td>
							{stats.mostRecentScore === null ||
							stats.mostRecentScore.timeAchieved === null
								? "Unknown."
								: MillisToSince(stats.mostRecentScore.timeAchieved)}
						</td>
					</tr>
					<tr>
						<td>First Play</td>
						<td>
							{stats.firstScore === null || stats.firstScore.timeAchieved === null
								? "Unknown."
								: MillisToSince(stats.firstScore.timeAchieved)}
						</td>
					</tr>
					<tr>
						<td>
							<QuickTooltip
								tooltipContent={`All of your session lengths added together. This makes for a rough estimate of playtime, depending on how much you use ${TachiConfig.NAME}.`}
							>
								<div
									style={{
										textDecoration: "underline",
										textDecorationStyle: "dotted",
									}}
								>
									Session Playtime
								</div>
							</QuickTooltip>
						</td>
						<td>{FormatDurationHours(stats.playtime)}</td>
					</tr>
				</MiniTable>
			</div>
			<div className="col-12 col-md-6 col-lg-3">
				<UserGameRatingsTable ugs={stats.gameStats} />
			</div>
			<div className="col-12 col-lg-3">
				<UserGameRankingData
					game={game}
					rankingData={stats.rankingData}
					userID={reqUser.id}
				/>
			</div>
			{/* if someone is logged in and they aren't the user they're viewing */}
			{/* give them the option to add them as a rival or follow them */}
			{userSettings && reqUser.id !== userSettings.userID && (
				<div
					className="col-12 w-100 d-flex justify-content-center mt-8"
					style={{
						gap: "30px",
					}}
				>
					{/* has the logged in user played this game? */}
					{/* otherwise, they can't rival. */}
					{settings && (
						<>
							{settings.rivals.includes(reqUser.id) ? (
								<Button
									onClick={async () => {
										const newRivals = settings.rivals.filter(
											(e) => e !== reqUser.id,
										);

										const res = await APIFetchV1(
											`/users/${settings.userID}/games/${game}/rivals`,
											{
												method: "PUT",
												body: JSON.stringify({
													rivalIDs: newRivals,
												}),
												headers: {
													"Content-Type": "application/json",
												},
											},
										);

										if (res.success) {
											SendSuccessToast(
												`Removed ${reqUser.username} from your rivals.`,
											);
											setSettings({
												...settings,
												rivals: newRivals,
											});
										} else {
											SendErrorToast(HumaniseError(res.description));
										}
									}}
									variant="outline-danger"
								>
									Remove as Rival
								</Button>
							) : (
								<Button
									disabled={settings.rivals.length >= MAX_RIVALS}
									onClick={async () => {
										const newRivals = [...settings.rivals, reqUser.id];

										const res = await APIFetchV1(
											`/users/${settings.userID}/games/${game}/rivals`,
											{
												method: "PUT",
												body: JSON.stringify({
													rivalIDs: newRivals,
												}),
												headers: {
													"Content-Type": "application/json",
												},
											},
										);

										if (res.success) {
											SendSuccessToast(
												`Added ${reqUser.username} to your rivals!`,
											);
											setSettings({
												...settings,
												rivals: newRivals,
											});
										} else {
											SendErrorToast(HumaniseError(res.description));
										}
									}}
									variant="outline-success"
								>
									{settings.rivals.length >= MAX_RIVALS
										? "At max rivals!"
										: "Add as rival"}
								</Button>
							)}
						</>
					)}
					<FollowUserButton userToFollow={reqUser} />
				</div>
			)}
		</>
	);
}

export function UserGameNav({
	baseUrl,
	isRequestedUser,
	game,
}: {
	baseUrl: string;
	game: V3Game;
	isRequestedUser: boolean;
}) {
	const navItems = [
		<Navbar.Item key="overview" to={`${baseUrl}/`}>
			Overview & Activity
		</Navbar.Item>,
		<Navbar.Item key="scores" to={`${baseUrl}/scores`}>
			Scores
		</Navbar.Item>,
		<Navbar.Item key="folders" to={`${baseUrl}/folders`}>
			Folders
		</Navbar.Item>,
		<Navbar.Item key="sessions" to={`${baseUrl}/sessions`}>
			Sessions
		</Navbar.Item>,
	];

	const utilsName = GetGameUtilsName(game, isRequestedUser);

	if (utilsName) {
		navItems.push(
			<Navbar.Item key="utils" to={`${baseUrl}/utils`}>
				{utilsName}
			</Navbar.Item>,
		);
	}

	if (isRequestedUser) {
		navItems.push(
			<Navbar.Item key="rivals" to={`${baseUrl}/rivals`}>
				Rivals
			</Navbar.Item>,
			<Navbar.Item key="targets" to={`${baseUrl}/targets`}>
				Goals & Quests
			</Navbar.Item>,
		);
	}

	navItems.push(
		<Navbar.Item key="leaderboard" to={`${baseUrl}/leaderboard`}>
			Leaderboard
		</Navbar.Item>,
	);

	if (isRequestedUser) {
		navItems.push(
			<Navbar.Item key="settings" to={`${baseUrl}/settings`}>
				Settings
			</Navbar.Item>,
		);
	}

	return (
		<div className="mx-n9 align-items-center mb-0">
			<Navbar>{navItems}</Navbar>
		</div>
	);
}
