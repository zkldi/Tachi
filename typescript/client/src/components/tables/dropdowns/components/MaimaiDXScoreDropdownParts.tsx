import GekichumaiScoreChart from "#components/charts/GekichumaiScoreChart";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectNav from "#components/util/SelectNav";
import { type SetState } from "#types/react";
import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import {
	type ChartDocument,
	type Difficulties,
	type PBScoreDocument,
	type ScoreData,
	type ScoreDocument,
	type SongDocument,
} from "tachi-common";

type ChartType = "Life" | "Score";

export function MaimaiDXGraphsComponent({
	score,
	chart,
}: {
	chart: ChartDocument<"maimaidx">;
	score: PBScoreDocument<"maimaidx"> | ScoreDocument<"maimaidx">;
}) {
	const [graph, setGraph] = useState<ChartType>("Score");
	const { percentGraph, lifeGraph } = score.scoreData.optional;

	if (!percentGraph && !lifeGraph) {
		return <Box message="No charts available" />;
	}

	return (
		<Inner
			chart={chart}
			graph={graph}
			lifeGraph={lifeGraph}
			percentGraph={percentGraph}
			score={score}
			setGraph={setGraph}
		/>
	);
}

function Inner({
	score,
	chart,
	graph,
	setGraph,
	percentGraph,
	lifeGraph,
}: {
	chart: ChartDocument<"maimaidx">;
	graph: ChartType;
	lifeGraph: (number | null)[] | null | undefined;
	percentGraph: (number | null)[] | null | undefined;
	score: PBScoreDocument<"maimaidx"> | ScoreDocument<"maimaidx">;
	setGraph: SetState<ChartType>;
}) {
	const { data, error } = useApiQuery<{
		song: SongDocument<"maimaidx">;
	}>(`/games/maimaidx/songs/${score.songID}`);

	if (error !== null || data === undefined) {
		return <Box message="Error retrieving chart" />;
	}

	if (!data.song.data.duration) {
		return <Box message="No charts available" />;
	}

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					{percentGraph && (
						<SelectNav id={"Score" as const} setValue={setGraph} value={graph}>
							Percent
						</SelectNav>
					)}
					{lifeGraph && (
						<SelectNav id={"Life" as const} setValue={setGraph} value={graph}>
							Life
						</SelectNav>
					)}
				</Nav>
			</div>
			<div className="col-12">
				<GraphComponent
					difficulty={chart.difficulty}
					scoreData={score.scoreData}
					song={data.song}
					type={graph}
				/>
			</div>
		</>
	);
}

function GraphComponent({
	scoreData,
	song,
	difficulty,
	type,
}: {
	difficulty: Difficulties["maimaidx"];
	scoreData: ScoreData<"maimaidx">;
	song: SongDocument<"maimaidx">;
	type: ChartType;
}) {
	const values =
		type === "Score" ? scoreData.optional.percentGraph! : scoreData.optional.lifeGraph!;
	return (
		<GekichumaiScoreChart
			data={[
				{
					id: type,
					data: values.map((e, i) => ({ x: i, y: e })),
				},
			]}
			difficulty={difficulty}
			duration={song.data.duration!}
			game="maimaidx"
			height="360px"
			mobileHeight="175px"
			type={type}
		/>
	);
}

function Box({ message }: { message: string }) {
	return (
		<div className="col-12">
			<div
				className="d-flex align-items-center justify-content-center"
				style={{ height: "200px" }}
			>
				<span className="text-body-secondary">{message}</span>
			</div>
		</div>
	);
}
