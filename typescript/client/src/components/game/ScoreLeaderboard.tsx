import PBTable from "#components/tables/pbs/PBTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { type ScoreLeaderboardReturns } from "#types/api-returns";
import { type GameProps } from "#types/react";
import { type PBDataset } from "#types/tables";
import { DEFAULT_BAR_PROPS } from "#util/charts";
import { CreateChartMap, CreateUserMap } from "#util/data";
import { FormatGameScoreRatingName } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import { ResponsiveBar } from "@nivo/bar";
import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import { COLOUR_SET, CreateSongMap, GetGameConfig, type integer } from "tachi-common";

const USER_COLOURS = [
	COLOUR_SET.blue,
	COLOUR_SET.red,
	COLOUR_SET.green,
	COLOUR_SET.pink,
	COLOUR_SET.purple,
	COLOUR_SET.orange,
];

export default function ScoreLeaderboard({
	game,
	url,
	refreshDeps = [],
}: { refreshDeps?: Array<string>; url: string } & GameProps) {
	const gameConfig = GetGameConfig(game);

	const defaultAlg = useScoreRatingAlg(game);

	const [alg, setAlg] = useState(defaultAlg);

	const SelectComponent =
		Object.keys(gameConfig.scoreRatingAlgs).length > 1 ? (
			<Form.Select onChange={(e) => setAlg(e.target.value as any)} value={alg}>
				{Object.keys(gameConfig.scoreRatingAlgs).map((e) => (
					<option key={e} value={e}>
						{FormatGameScoreRatingName(game, e)}
					</option>
				))}
			</Form.Select>
		) : null;

	const { data, error } = useApiQuery<ScoreLeaderboardReturns>(
		`${url}?alg=${alg}`,
		{},
		refreshDeps,
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

	const songMap = CreateSongMap(data.songs);
	const chartMap = CreateChartMap(data.charts);
	const userMap = CreateUserMap(data.users);

	const pbDataset: PBDataset = [];

	for (const [index, pb] of data.pbs.entries()) {
		pbDataset.push({
			...pb,
			__related: {
				chart: chartMap.get(pb.chartID)!,
				song: songMap.get(pb.songID)!,
				index,
				user: userMap.get(pb.userID)!,
			},
		});
	}

	return (
		<>
			{SelectComponent}
			<Divider />
			<DistributionChart dataset={pbDataset} />
			<Divider />
			<PBTable
				alg={alg}
				dataset={pbDataset}
				defaultRankingViewMode="both-if-self"
				game={game}
				indexCol
				showChart
				showUser
			/>
		</>
	);
}

function DistributionChart({ dataset }: { dataset: PBDataset }) {
	const dist: Record<string, integer> = {};

	for (const pb of dataset) {
		const key = pb.__related.user?.username;

		if (key === undefined) {
			continue;
		}

		if (key in dist) {
			dist[key]++;
		} else {
			dist[key] = 1;
		}
	}

	const aggregatedData = Object.entries(dist)
		.map(([username, count]) => ({ username, count }))
		.sort(NumericSOV((x) => x.count));

	const usernames = [...new Set(aggregatedData.map((e) => e.username))];

	return (
		<div style={{ height: 200, width: "100%" }}>
			<ResponsiveBar
				colors={(x) =>
					USER_COLOURS[(usernames.indexOf(x.data.username) ?? 0) % USER_COLOURS.length]
				}
				data={aggregatedData}
				indexBy="username"
				isInteractive={false}
				keys={["count"]}
				layout="vertical"
				margin={{ left: 80, bottom: 40, top: 20, right: 20 }}
				{...DEFAULT_BAR_PROPS}
			/>
		</div>
	);
}
