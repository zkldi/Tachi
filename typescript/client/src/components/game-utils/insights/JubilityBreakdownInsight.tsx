import Card from "#components/layout/page/Card";
import PBTable from "#components/tables/pbs/PBTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import usePreferredRanking from "#components/util/usePreferredRanking";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { type PBDataset } from "#types/tables";
import { CreateChartMap } from "#util/data";
import { ToFixedFloor } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import { Col, Row } from "react-bootstrap";
import {
	type ChartDocument,
	CreateSongMap,
	type PBScoreDocument,
	type SongDocument,
} from "tachi-common";

function Component({ game, reqUser }: GameProfileProps) {
	const { data, error } = useApiQuery<{
		charts: Array<ChartDocument>;
		other: Array<PBScoreDocument>;
		pickUp: Array<PBScoreDocument>;
		songs: Array<SongDocument>;
	}>(`/users/${reqUser.id}/games/${game}/jubility`);

	const preferredRanking = usePreferredRanking();

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const songMap = CreateSongMap(data.songs);
	const chartMap = CreateChartMap(data.charts);

	const pickUpDataset: PBDataset = [];
	const normalDataset: PBDataset = [];

	const sortedJubilities = [...data.pickUp, ...data.other]
		.map((e) => e.calculatedData.jubility)
		.sort(NumericSOV((x) => x ?? -Infinity, true));

	for (const pb of data.pickUp) {
		const song = songMap.get(pb.songID);
		const chart = chartMap.get(pb.chartID);

		if (!song) {
			continue;
		}

		if (!chart) {
			continue;
		}

		pickUpDataset.push({
			...pb,
			__related: {
				chart,
				song,
				index: sortedJubilities.indexOf(pb.calculatedData.jubility),
			},
		});
	}

	for (const pb of data.other) {
		const song = songMap.get(pb.songID);
		const chart = chartMap.get(pb.chartID);

		if (!song) {
			continue;
		}

		if (!chart) {
			continue;
		}

		normalDataset.push({
			...pb,
			__related: {
				chart,
				song,
				index: sortedJubilities.indexOf(pb.calculatedData.jubility),
			},
		});
	}

	return (
		<Row>
			<Col xs={12}>
				<Card
					header={`Pick-Up (${ToFixedFloor(
						pickUpDataset.reduce((a, e) => a + (e.calculatedData.jubility ?? 0), 0),
						1,
					)})`}
				>
					<PBTable
						alg="jubility"
						dataset={pickUpDataset}
						defaultRankingViewMode={preferredRanking}
						game={game}
						indexCol
					/>
				</Card>
				<Divider />
				<Card
					header={`Common (${ToFixedFloor(
						normalDataset.reduce((a, e) => a + (e.calculatedData.jubility ?? 0), 0),
						1,
					)})`}
				>
					<PBTable
						alg="jubility"
						dataset={normalDataset}
						defaultRankingViewMode={preferredRanking}
						game={game}
						indexCol
					/>
				</Card>
			</Col>
		</Row>
	);
}

export const JubilityBreakdownInsight: GameUtility = {
	name: "Jubility Breakdown",
	urlPath: "jubility",
	description: `See what PBs are going into profile jubility!`,
	component: Component,
};
