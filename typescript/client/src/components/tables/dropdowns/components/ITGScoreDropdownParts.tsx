import ITGDensityChart from "#components/charts/ITGDensityChart";
import SelectNav from "#components/util/SelectNav";
import React, { useState } from "react";
import { Nav } from "react-bootstrap";
import { type ChartDocument, type PBScoreDocument, type ScoreDocument } from "tachi-common";

export function ITGGraphsComponent({
	score,
	chart,
}: {
	chart: ChartDocument<"itg-stamina">;
	score: PBScoreDocument<"itg-stamina"> | ScoreDocument<"itg-stamina">;
}) {
	const [graph, setGraph] = useState("DENSITY");

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					<SelectNav id="DENSITY" setValue={setGraph} value={graph}>
						Chart Density
					</SelectNav>
					<SelectNav disabled id="HISTOGRAM" setValue={setGraph} value={graph}>
						Judgement Histogram
					</SelectNav>
				</Nav>
			</div>
			<div className="col-12">
				{chart.data.npsPerMeasure ? (
					<ITGDensityChart
						data={[
							{
								id: "chart",
								data: chart.data.npsPerMeasure.map((e, i) => ({
									x: i,
									y: e,
								})),
							},
						]}
						height="200px"
						mobileHeight="175px"
					/>
				) : (
					<div
						className="d-flex align-items-center justify-content-center"
						style={{ height: "200px" }}
					>
						<span className="text-body-secondary">No chart graph :(</span>
					</div>
				)}
			</div>
		</>
	);
}
