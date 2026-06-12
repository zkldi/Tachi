import ClassBadge from "#components/game/ClassBadge";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import MiniTable from "#components/tables/components/MiniTable";
import GentleLink from "#components/util/GentleLink";
import LinkButton from "#components/util/LinkButton";
import LoadingWrapper from "#components/util/LoadingWrapper";
import { useProfileRatingAlg } from "#components/util/useScoreRatingAlg";
import { type GameLeaderboard, type UserGameLeaderboardAdjacent } from "#types/api-returns";
import { type GameProfileProps, type GameProps, type SetState } from "#types/react";
import { APIFetchV1, type UnsuccessfulAPIFetchResponse } from "#util/api";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatGameProfileRating, FormatGameProfileRatingName, IsNotNullish } from "#util/misc";
import { StrSOV } from "#util/sorts";
import { useState } from "react";
import { useQuery } from "react-query";
import {
	type Classes,
	COLOUR_SET,
	FormatGame,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	type integer,
	type ProfileRatingAlgorithms,
	type UserDocument,
	type UserGameStatsWithProfileLeaderboardRank,
	type V3Game,
} from "tachi-common";

interface LeaderboardsData {
	stats: UserGameLeaderboardAdjacent;
	leaderboard: GameLeaderboard;
}

export default function LeaderboardsPage({ reqUser, game }: GameProfileProps) {
	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Leaderboard",
		],
		[reqUser, game],
		`${reqUser.username}'s ${FormatGame(game)} Leaderboard`,
	);

	const defaultRating = useProfileRatingAlg(game);
	const [alg, setAlg] = useState(defaultRating);

	const url = `/users/${reqUser.id}/games/${game}/leaderboard-adjacent?alg=${alg}`;

	const { data, error } = useQuery<LeaderboardsData, UnsuccessfulAPIFetchResponse>(
		url,
		async () => {
			const res = await APIFetchV1<UserGameLeaderboardAdjacent>(url);

			if (!res.success) {
				throw res;
			}

			const lRes = await APIFetchV1<GameLeaderboard>(
				`/games/${game}/leaderboard?limit=3&alg=${alg}`,
			);

			if (!lRes.success) {
				throw lRes;
			}

			return {
				stats: res.body,
				leaderboard: lRes.body,
			};
		},
	);

	return (
		<LoadingWrapper {...{ dataset: data, error }}>
			<LeaderboardsPageContent {...{ reqUser, game, data: data!, alg, setAlg }} />
		</LoadingWrapper>
	);
}

function LeaderboardsPageContent({
	reqUser,
	game,
	data,
	alg,
}: {
	alg: ProfileRatingAlgorithms[V3Game];
	data: LeaderboardsData;
	reqUser: UserDocument;
	setAlg: SetState<ProfileRatingAlgorithms[V3Game]>;
} & GameProps) {
	const { stats, leaderboard } = data;

	const gameConfig = GetGameConfig(game);

	const userMap = new Map<integer, UserDocument>();

	for (const u of stats.users) {
		userMap.set(u.id, u);
	}

	for (const u of leaderboard.users) {
		userMap.set(u.id, u);
	}

	userMap.set(reqUser.id, reqUser);

	const bestNearbyUser = stats.thisUsersRanking.ranking - stats.above.length - 1;

	function LeaderboardRow({ s }: { s: UserGameStatsWithProfileLeaderboardRank }) {
		return (
			<tr
				style={{
					backgroundColor:
						reqUser.id === s.userID ? ChangeOpacity(COLOUR_SET.gold, 0.15) : undefined,
					height: reqUser.id === s.userID ? "50px" : undefined,
				}}
			>
				<td>
					<strong>#{s.rank}</strong>
					{reqUser.id === s.userID && (
						<small className="text-body-secondary">
							/{stats.thisUsersRanking.outOf}
						</small>
					)}
				</td>
				<td>
					<GentleLink to={`/u/${userMap.get(s.userID)!.username}/games/${game}`}>
						{userMap.get(s.userID)?.username}
					</GentleLink>
				</td>
				<td>
					{IsNotNullish(s.ratings[alg])
						? FormatGameProfileRating(game, alg, s.ratings[alg]!)
						: "No Data."}
				</td>
				<td>
					{Object.entries(s.classes).length
						? Object.entries(s.classes)
								.sort(StrSOV((x) => x[0]))
								.map(
									([k, v]) =>
										v && (
											<ClassBadge
												classSet={k as Classes[V3Game]}
												classValue={v}
												game={game}
												key={`${k}:${v}`}
											/>
										),
								)
						: "No Classes"}
				</td>
			</tr>
		);
	}

	return (
		<Card
			cardBodyClassName="overflow-x-auto d-flex flex-column justify-content-center p-4"
			footer={
				<LinkButton className="float-end" to={`/games/${game}/leaderboards`}>
					View Global Leaderboards
				</LinkButton>
			}
			header={"Leaderboard"}
		>
			<MiniTable
				className="text-center"
				headers={["Position", "User", FormatGameProfileRatingName(game, alg), "Classes"]}
			>
				<>
					{bestNearbyUser >= 1 &&
						leaderboard.gameStats
							.slice(0, bestNearbyUser)
							.map((s) => <LeaderboardRow key={s.userID} s={s} />)}
					{bestNearbyUser > 4 && (
						<tr style={{ lineHeight: "0.5rem" }}>
							<td colSpan={4}>...</td>
						</tr>
					)}
					{[...stats.above, stats.thisUsersStats, ...stats.below].map((s) => (
						<LeaderboardRow key={s.userID} s={s} />
					))}
				</>
			</MiniTable>
		</Card>
	);
}
