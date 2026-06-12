import ClassBadge from "#components/game/ClassBadge";
import ScoreLeaderboard from "#components/game/ScoreLeaderboard";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import IndexCell from "#components/tables/cells/IndexCell";
import UserCell from "#components/tables/cells/UserCell";
import TachiTable, { type Header } from "#components/tables/components/TachiTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import { useProfileRatingAlg } from "#components/util/useScoreRatingAlg";
import { type UserLeaderboardReturns } from "#types/api-returns";
import { type GameProps } from "#types/react";
import { type UGSDataset } from "#types/tables";
import { CreateUserMap } from "#util/data";
import {
	FormatGameProfileRating,
	FormatGameProfileRatingName,
	getProfileRatingAlgKeysInDisplayOrder,
} from "#util/misc";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, { useState } from "react";
import { Col, Form, Row } from "react-bootstrap";
import { type AnyProfileRatingAlg, type Classes, FormatGame, type V3Game } from "tachi-common";

export default function GameLeaderboardsPage({ game }: GameProps) {
	useSetSubheader(
		["Games", FormatGame(game), "Leaderboards"],
		[game],
		`${FormatGame(game)} Leaderboards`,
	);

	const [mode, setMode] = useState<"profile" | "score">("profile");

	return (
		<Row>
			<Col className="d-flex justify-content-center" xs={12}>
				<div className="btn-group">
					<SelectButton id="profile" setValue={setMode} value={mode}>
						<Icon type="user" /> User Leaderboards
					</SelectButton>
					<SelectButton id="score" setValue={setMode} value={mode}>
						<Icon type="sort-numeric-up-alt" /> PB Leaderboards
					</SelectButton>
				</div>
			</Col>
			<Col xs={12}>
				<Divider />
				{mode === "profile" ? (
					<ProfileLeaderboard game={game} />
				) : (
					<ScoreLeaderboard game={game} url={`/games/${game}/pb-leaderboard`} />
				)}
			</Col>
		</Row>
	);
}

function ProfileLeaderboard({ game }: GameProps) {
	const defaultAlg = useProfileRatingAlg(game);

	const [alg, setAlg] = useState(defaultAlg);

	const profileAlgKeys = getProfileRatingAlgKeysInDisplayOrder(
		game,
	) as Array<AnyProfileRatingAlg>;

	const SelectComponent =
		profileAlgKeys.length > 1 ? (
			<Form.Select onChange={(e) => setAlg(e.target.value as any)} value={alg}>
				{profileAlgKeys.map((e) => (
					<option key={e} value={e}>
						{FormatGameProfileRatingName(game, e)}
					</option>
				))}
			</Form.Select>
		) : null;

	const { data, error } = useApiQuery<UserLeaderboardReturns>(
		`/games/${game}/leaderboard?alg=${alg}&limit=500`,
	);

	if (error) {
		return (
			<>
				{SelectComponent}
				<ApiError error={error} />
			</>
		);
	}

	if (!data) {
		return (
			<>
				{SelectComponent}
				<Loading />
			</>
		);
	}

	const userMap = CreateUserMap(data.users);

	const userDataset: UGSDataset = [];

	for (const gs of data.gameStats) {
		userDataset.push({
			...gs,
			__related: {
				user: userMap.get(gs.userID)!,
				index: gs.rank - 1,
			},
		});
	}

	return (
		<>
			{SelectComponent}
			<Divider />
			<TachiTable
				dataset={userDataset}
				entryName="Rankers"
				headers={[
					["Ranking", "Rank", NumericSOV((x) => x.rank)],
					["User", "User", StrSOV((x) => x.__related.user.username)],
					...profileAlgKeys.map(
						(e) =>
							[
								FormatGameProfileRatingName(game, e),
								FormatGameProfileRatingName(game, e),
								NumericSOV((x) => x.ratings[e] ?? -Infinity),
							] as Header<UGSDataset[0]>,
					),
					["Classes", "Classes"],
				]}
				rowFunction={(r) => (
					<tr>
						<IndexCell index={r.__related.index} />
						<UserCell game={game} user={r.__related.user} />
						{profileAlgKeys.map((e) => (
							<td key={e}>
								{r.ratings[e]
									? FormatGameProfileRating(game, e, r.ratings[e]!)
									: "No Data."}
							</td>
						))}
						<td>
							{Object.keys(r.classes).length === 0 ? (
								<Muted>None</Muted>
							) : (
								Object.entries(r.classes)
									.sort(StrSOV((x) => x[0]))
									.map(
										([k, v]) =>
											v && (
												<ClassBadge
													classSet={k as Classes[V3Game]}
													classValue={v}
													game={game}
													key={k}
												/>
											),
									)
							)}
						</td>
					</tr>
				)}
			/>
		</>
	);
}
