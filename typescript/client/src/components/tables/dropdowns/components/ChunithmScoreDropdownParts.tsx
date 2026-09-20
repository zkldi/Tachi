import GekichumaiScoreChart from "#components/charts/GekichumaiScoreChart";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectNav from "#components/util/SelectNav";
import { useState } from "react";
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

export function ChunithmGraphsComponent({
	score,
	chart,
}: {
	chart: ChartDocument<"chunithm">;
	score: PBScoreDocument<"chunithm"> | ScoreDocument<"chunithm">;
}) {
	const [graph, setGraph] = useState<ChartType>("Score");
	const { data, error } = useApiQuery<{
		song: SongDocument<"chunithm">;
	}>(`/games/chunithm/songs/${score.songID}`);

	if (error !== null || data === undefined) {
		return <Box message="Error retrieving chart" />;
	}

	if (!score.scoreData.optional.scoreGraph && !score.scoreData.optional.lifeGraph) {
		return <Box message="No charts available" />;
	}

	if (!data.song.data.duration) {
		return <Box message="No charts available" />;
	}

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					{score.scoreData.optional.scoreGraph && (
						<SelectNav id={"Score" as const} setValue={setGraph} value={graph}>
							Score
						</SelectNav>
					)}
					{score.scoreData.optional.lifeGraph && (
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
	difficulty: Difficulties["chunithm"];
	scoreData: ScoreData<"chunithm">;
	song: SongDocument<"chunithm">;
	type: ChartType;
}) {
	const values =
		type === "Score" ? scoreData.optional.scoreGraph! : scoreData.optional.lifeGraph!;
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
			game="chunithm"
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
