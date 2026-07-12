import GekichumaiScoreChart from "#components/charts/GekichumaiScoreChart";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectNav from "#components/util/SelectNav";
import { type SetState } from "#types/react";
import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import {
	type ChartDocument,
	type PBScoreDocument,
	type ScoreData,
	type ScoreDocument,
	type SongDocument,
} from "tachi-common";

type ChartType = "Bells" | "Life" | "Platinum" | "Score";

export function OngekiGraphsComponent({
	score,
	chart,
}: {
	chart: ChartDocument<"ongeki">;
	score: PBScoreDocument<"ongeki"> | ScoreDocument<"ongeki">;
}) {
	const [graph, setGraph] = useState<ChartType>("Score");
	const available =
		score.scoreData.optional.scoreGraph &&
		score.scoreData.optional.bellGraph &&
		score.scoreData.optional.lifeGraph &&
		score.scoreData.optional.totalBellCount !== null &&
		score.scoreData.optional.totalBellCount !== undefined;

	// Platinum graphs were added later so they need a separate check
	const availablePlat = score.scoreData.optional.platinumGraph;

	if (!available) {
		return <Box message="No charts available" />;
	}

	return (
		<Inner
			available={available}
			availablePlat={availablePlat}
			chart={chart}
			graph={graph}
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
	available,
	availablePlat,
}: {
	available: boolean;
	availablePlat: (number | null)[] | null | undefined;
	chart: ChartDocument<"ongeki">;
	graph: ChartType;
	score: PBScoreDocument<"ongeki"> | ScoreDocument<"ongeki">;
	setGraph: SetState<ChartType>;
}) {
	const { data, error } = useApiQuery<{
		song: SongDocument<"ongeki">;
	}>(`/games/ongeki/songs/${score.songID}`);
	if (error !== null || data === undefined) {
		return <Box message="Error retrieving chart" />;
	}
	const song = data.song;

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					<SelectNav
						disabled={!available}
						id={"Score" as const}
						setValue={setGraph}
						value={graph}
					>
						Score
					</SelectNav>
					<SelectNav
						disabled={!availablePlat}
						id={"Platinum" as const}
						setValue={setGraph}
						value={graph}
					>
						P-Score
					</SelectNav>
					<SelectNav
						disabled={!available}
						id={"Bells" as const}
						setValue={setGraph}
						value={graph}
					>
						Bells
					</SelectNav>
					<SelectNav
						disabled={!available}
						id={"Life" as const}
						setValue={setGraph}
						value={graph}
					>
						Life
					</SelectNav>
				</Nav>
			</div>
			<div className="col-12">
				<GraphComponent
					chart={chart}
					scoreData={score.scoreData}
					song={song}
					type={graph}
				/>
			</div>
		</>
	);
}

function GraphComponent({
	type,
	scoreData,
	song,
	chart,
}: {
	chart: ChartDocument<"ongeki">;
	scoreData: ScoreData<"ongeki">;
	song: SongDocument<"ongeki">;
	type: ChartType;
}) {
	const values =
		type === "Score"
			? scoreData.optional.scoreGraph!
			: type === "Bells"
				? scoreData.optional.bellGraph!
				: type === "Life"
					? scoreData.optional.lifeGraph!
					: scoreData.optional.platinumGraph!;
	return (
		<GekichumaiScoreChart
			data={[
				{
					id: type,
					data: values.map((e, i) => ({ x: i, y: e })),
				},
			]}
			difficulty={chart.difficulty}
			duration={song.data.duration ?? 240}
			game="ongeki"
			height="360px"
			maximumAbsoluteValue={
				type === "Bells" ? scoreData.optional.totalBellCount! : chart.data.maxPlatScore
			}
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
