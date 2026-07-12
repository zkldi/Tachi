import Card from "#components/layout/page/Card";
import DifficultyCell from "#components/tables/cells/DifficultyCell";
import { StarField } from "#components/tables/cells/OngekiPlatinumCell";
import OngekiScoreRatingCell from "#components/tables/cells/OngekiScoreRatingCell";
import TachiTable from "#components/tables/components/TachiTable";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import GentleLink from "#components/util/GentleLink";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameUtility } from "#types/game";
import { type GameProfileProps } from "#types/react";
import { type PBDataset } from "#types/tables";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartLink, CreateChartMap } from "#util/data";
import { FormatMillions } from "#util/misc";
import { NumericSOV } from "#util/sorts";
import { Col, Row } from "react-bootstrap";
import {
	type AnyScoreRatingAlg,
	type ChartDocument,
	COLOUR_SET,
	CreateSongMap,
	FmtNum,
	type integer,
	type PBScoreDocument,
	type SongDocument,
	type V3Game,
} from "tachi-common";

function ComponentClassic({ game, reqUser }: GameProfileProps) {
	if (game !== "ongeki") {
		throw new Error("Game is not ongeki");
	}

	const { data, error } = useApiQuery<{
		charts: Array<ChartDocument<"ongeki">>;
		pbs: Array<PBScoreDocument<"ongeki">>;
		songs: Array<SongDocument<"ongeki">>;
	}>(`/users/${reqUser.id}/games/${game}/pbs/best?alg=rating`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const flatDataset: PBDataset<"ongeki"> = CreateFlatDataset<"ongeki">(data, "rating", 45);
	const compoundDataset = ColumnMerge<"ongeki">(flatDataset, 3);

	const classicRating =
		Math.floor(
			flatDataset.reduce((a, e) => a + Math.round((e.calculatedData.rating ?? 0) * 100), 0) /
				flatDataset.length,
		) / 100;

	return (
		<Row>
			<Col xs={12}>
				<Card
					header={`${reqUser.username}'s NaiveRatingClassic: ${classicRating.toFixed(2)}`}
				>
					<TachiTable
						dataset={compoundDataset}
						entryName="Errors"
						headers={[]}
						noBottomDisplayPager
						noTopDisplayStr
						pageLen={100}
						rowFunction={(pbs) => (
							<CompactRow
								game={game}
								lampField={(pb) => (
									<ShortLamp
										bellLamp={pb.scoreData.bellLamp}
										grade={pb.scoreData.grade}
										noteLamp={pb.scoreData.noteLamp}
									/>
								)}
								pbs={pbs}
								ratingField={(pb) => pb.calculatedData.rating?.toFixed(2) ?? "0.00"}
								scoreField={(pb) => FormatMillions(pb.scoreData.score)}
							/>
						)}
					/>
				</Card>
			</Col>
		</Row>
	);
}

function ComponentRefresh({ game, reqUser }: GameProfileProps) {
	if (game !== "ongeki") {
		throw new Error("Game is not ongeki");
	}

	const query1 = useApiQuery<{
		charts: Array<ChartDocument<"ongeki">>;
		pbs: Array<PBScoreDocument<"ongeki">>;
		songs: Array<SongDocument<"ongeki">>;
	}>(`/users/${reqUser.id}/games/${game}/pbs/best?alg=scoreRating`);

	const query2 = useApiQuery<{
		charts: Array<ChartDocument<"ongeki">>;
		pbs: Array<PBScoreDocument<"ongeki">>;
		songs: Array<SongDocument<"ongeki">>;
	}>(`/users/${reqUser.id}/games/${game}/pbs/best?alg=starRating`);

	if (query1.error) {
		return <ApiError error={query1.error} />;
	}

	if (query2.error) {
		return <ApiError error={query2.error} />;
	}

	if (!query1.data || !query2.data) {
		return <Loading />;
	}

	const flatDatasetScore: PBDataset<"ongeki"> = CreateFlatDataset<"ongeki">(
		query1.data,
		"scoreRating",
		60,
	);
	const flatDatasetStar: PBDataset<"ongeki"> = CreateFlatDataset<"ongeki">(
		query2.data,
		"starRating",
		51,
	);

	const datasetScore = ColumnMerge<"ongeki">(flatDatasetScore, 3);
	const datasetStar = ColumnMerge<"ongeki">(flatDatasetStar, 3);

	const scoreR1k = Math.floor(
		flatDatasetScore.reduce(
			(a, e) => a + Math.round((e.calculatedData.scoreRating ?? 0) * 1000),
			0,
		) / 60,
	);
	const starR1k = Math.floor(
		flatDatasetStar
			.slice(0, 50)
			.reduce((a, e) => a + Math.round((e.calculatedData.starRating ?? 0) * 1000), 0) / 50,
	);
	const finalRating = ((Math.floor(scoreR1k * 1.2) + starR1k) / 1000.0).toFixed(3);

	return (
		<Row>
			<Col xs={12}>
				<Card
					header={`${reqUser.username}'s NaiveRatingRefresh: ${(scoreR1k / 1000).toFixed(
						3,
					)} x 1.2 + ${(starR1k / 1000).toFixed(3)} = ${finalRating}`}
				>
					<TachiTable
						dataset={datasetScore}
						entryName="Errors"
						headers={[]}
						noBottomDisplayPager
						noTopDisplayStr
						pageLen={100}
						rowFunction={(pbs) => (
							<CompactRow
								game={game}
								lampField={(pb) => (
									<ShortLamp
										bellLamp={pb.scoreData.bellLamp}
										grade={pb.scoreData.grade}
										noteLamp={pb.scoreData.noteLamp}
									/>
								)}
								pbs={pbs}
								ratingField={(pb) => <OngekiScoreRatingCell score={pb} />}
								scoreField={(pb) => FormatMillions(pb.scoreData.score)}
							/>
						)}
					/>
					<Divider />
					<TachiTable
						dataset={datasetStar}
						entryName="Errors"
						headers={[]}
						noBottomDisplayPager
						noTopDisplayStr
						pageLen={100}
						rowFunction={(pbs) => (
							<CompactRow
								count={50}
								game={game}
								lampField={(pb) => (
									<>
										<StarField
											compact={true}
											stars={pb.scoreData.platinumStars}
										/>
									</>
								)}
								pbs={pbs}
								ratingField={(pb) =>
									pb.calculatedData.starRating?.toFixed(3) ?? "0.000"
								}
								scoreField={(pb, chart) =>
									`${FmtNum(pb.scoreData.platinumScore)}/${FmtNum(
										chart.data.maxPlatScore,
									)}`
								}
							/>
						)}
					/>
				</Card>
			</Col>
		</Row>
	);
}

function CompactRow({
	pbs,
	game,
	count,
	scoreField,
	ratingField,
	lampField,
}: {
	count?: number;
	game: V3Game;
	lampField: (pb: PBScoreDocument<"ongeki">) => string | JSX.Element;
	pbs: PBDataset<"ongeki">[0][];
	ratingField: (pb: PBScoreDocument<"ongeki">) => string | JSX.Element;
	scoreField: (
		pb: PBScoreDocument<"ongeki">,
		chart: ChartDocument<"ongeki">,
	) => string | JSX.Element;
}) {
	return (
		<tr>
			{pbs.map((pb) => {
				const index = pb.__related.index;
				const chart = pb.__related.chart;

				if (count !== undefined && index > count) {
					return <></>;
				}
				return (
					<>
						<IndexCellCustom index={index} />
						<DifficultyCell alwaysShort chart={chart} game={game} />
						<CompactCell
							chart={chart}
							lampField={lampField}
							pb={pb}
							ratingField={ratingField}
							scoreField={scoreField}
							song={pb.__related.song}
						/>
					</>
				);
			})}
		</tr>
	);
}

function CompactCell({
	pb,
	chart,
	song,
	scoreField,
	ratingField,
	lampField,
}: {
	chart: ChartDocument<"ongeki">;
	lampField: (pb: PBScoreDocument<"ongeki">) => string | JSX.Element;
	pb: PBScoreDocument<"ongeki">;
	ratingField: (pb: PBScoreDocument<"ongeki">) => string | JSX.Element;
	scoreField: (
		pb: PBScoreDocument<"ongeki">,
		chart: ChartDocument<"ongeki">,
	) => string | JSX.Element;
	song: SongDocument;
}) {
	// Third-party scripts may find this useful
	const className = `c-${chart.data.inGameID}`;

	return (
		<td className={className} style={{ width: "300px" }}>
			<div className="d-flex flex-column gap-2" style={{ textAlign: "left" }}>
				<div>
					<GentleLink to={CreateChartLink(chart)}>
						<span style={{ fontSize: "120%" }}>{song.title}</span>
					</GentleLink>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: "5px",
					}}
				>
					<span>{scoreField(pb, chart)}</span>
					<strong style={{ fontSize: "105%" }}>{ratingField(pb)}</strong>
					<span>{lampField(pb)}</span>
				</div>
			</div>
		</td>
	);
}

function IndexCellCustom({ index }: { index: integer }) {
	const COLORS = ["rgba(212,175,55,0.2)", "rgba(192,192,192,0.2)", "rgba(139,69,19,0.2)"];

	return (
		<td
			style={{
				backgroundColor: index < 3 ? COLORS[index] : ChangeOpacity(COLOUR_SET.gray, 0.15),
			}}
		>
			<span className="text-body-secondary" style={{ marginRight: "1px" }}>
				#{index + 1}
			</span>
		</td>
	);
}

function ShortLamp({
	noteLamp,
	bellLamp,
	grade,
}: {
	bellLamp: string;
	grade: "A" | "AA" | "AAA" | "B" | "BB" | "BBB" | "C" | "D" | "S" | "SS" | "SSS" | "SSS+";
	noteLamp: string;
}) {
	let color1 = COLOUR_SET.gray;
	let text1 = "";
	let color2 = COLOUR_SET.gray;
	let text2 = "";
	const color3 = GAME_CLIENT_IMPLEMENTATIONS.ongeki.enumColours.grade[grade];

	if (noteLamp === "ALL BREAK+") {
		color1 = COLOUR_SET.vibrantBlue;
		text1 = "AB+";
	} else if (noteLamp === "ALL BREAK") {
		color1 = COLOUR_SET.white;
		text1 = "AB";
	} else if (noteLamp === "FULL COMBO") {
		color1 = COLOUR_SET.gold;
		text1 = "FC";
	}

	if (bellLamp === "FULL BELL") {
		color2 = COLOUR_SET.gold;
		text2 = "FB";
	}

	const style = {
		width: "2em",
		height: "2em",
		fontSize: "90%",
		paddingTop: "3px",
	};

	return (
		<span className="d-flex flex-row gap-1 text-center text-nowrap align-items-center">
			<span
				className="rounded-circle"
				style={{ ...style, backgroundColor: ChangeOpacity(color1, 0.2) }}
			>
				{text1}
			</span>
			<span
				className="rounded-circle"
				style={{ ...style, backgroundColor: ChangeOpacity(color2, 0.2) }}
			>
				{text2}
			</span>
			<span
				className="rounded-circle"
				style={{ ...style, backgroundColor: ChangeOpacity(color3, 0.2) }}
			>
				{grade}
			</span>
		</span>
	);
}

function CreateFlatDataset<T extends V3Game>(data: any, alg: AnyScoreRatingAlg, count: number) {
	const flatDataset: PBDataset<T> = [];

	const songMap = CreateSongMap(data.songs);
	const chartMap = CreateChartMap<T>(data.charts);

	const sortedRatings = data.pbs
		.map((e: PBScoreDocument) => e.calculatedData[alg])
		.sort(NumericSOV((x: number) => x ?? -Infinity, true));

	for (const pb of data.pbs.slice(0, count)) {
		const song = songMap.get(pb.songID);
		const chart = chartMap.get(pb.chartID);

		if (song === undefined || chart === undefined) {
			continue;
		}

		flatDataset.push({
			...pb,
			__related: {
				chart,
				song,
				index: sortedRatings.indexOf(pb.calculatedData[alg]),
			},
		});
	}

	return flatDataset;
}

function ColumnMerge<T extends V3Game>(flatDataset: PBDataset<T>, columns: number) {
	const compoundDataset: PBDataset<T>[] = [[]];
	for (const d of flatDataset) {
		const back = compoundDataset[compoundDataset.length - 1];
		back.push(d);
		if (back.length === columns) {
			compoundDataset.push([]);
		}
	}
	return compoundDataset.filter((p) => p.length > 0);
}

export const ONGEKIClassicBreakdownInsight: GameUtility = {
	name: "O.N.G.E.K.I. Classic Rating Breakdown",
	urlPath: "classic-rating",
	description: `See what PBs are going into your NaiveRatingClassic!`,
	component: ComponentClassic,
	personalUseOnly: false,
};

export const ONGEKIRefreshBreakdownInsight: GameUtility = {
	name: "O.N.G.E.K.I. Refresh Rating Breakdown",
	urlPath: "refresh-rating",
	description: `See what PBs are going into your NaiveRatingRefresh!`,
	component: ComponentRefresh,
	personalUseOnly: false,
};
