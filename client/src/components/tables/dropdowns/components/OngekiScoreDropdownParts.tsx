import SelectNav from "components/util/SelectNav";
import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import {
	ChartDocument,
	PBScoreDocument,
	ScoreData,
	ScoreDocument,
	SongDocument,
} from "tachi-common";
import GekichumaiScoreChart from "components/charts/GekichumaiScoreChart";
import useApiQuery from "components/util/query/useApiQuery";

type ChartType = "Score" | "Platinum" | "Bells" | "Life";

export function OngekiGraphsComponent({
	score,
	chart,
}: {
	score: ScoreDocument<"ongeki:Single"> | PBScoreDocument<"ongeki:Single">;
	chart: ChartDocument<"ongeki:Single">;
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

	const { data, error } = useApiQuery<{
		song: SongDocument<"ongeki">;
	}>(`/games/ongeki/Single/songs/${score.songID}`);
	if (error !== null || data === undefined) {
		return <Box message="Error retrieving chart" />;
	}
	const song = data.song;

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					<SelectNav id="Score" value={graph} setValue={setGraph} disabled={!available}>
						Score
					</SelectNav>
					<SelectNav
						id="Platinum"
						value={graph}
						setValue={setGraph}
						disabled={!availablePlat}
					>
						P-Score
					</SelectNav>
					<SelectNav id="Bells" value={graph} setValue={setGraph} disabled={!available}>
						Bells
					</SelectNav>
					<SelectNav id="Life" value={graph} setValue={setGraph} disabled={!available}>
						Life
					</SelectNav>
				</Nav>
			</div>
			<div className="col-12">
				<GraphComponent
					type={graph}
					scoreData={score.scoreData}
					song={song}
					chart={chart}
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
	type: ChartType;
	scoreData: ScoreData<"ongeki:Single">;
	song: SongDocument<"ongeki">;
	chart: ChartDocument<"ongeki:Single">;
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
			height="360px"
			mobileHeight="175px"
			type={type}
			maximumAbsoluteValue={
				type === "Bells" ? scoreData.optional.totalBellCount! : chart.data.maxPlatScore
			}
			difficulty={chart.difficulty}
			data={[
				{
					id: type,
					data: values.map((e, i) => ({ x: i, y: e })),
				},
			]}
			game="ongeki"
			duration={song.data.duration ?? 240}
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
