import IIDXLampChart from "#components/charts/IIDXLampChart";
import SelectNav from "#components/util/SelectNav";
import { IsScore } from "#util/asserts";
import React, { useEffect, useState } from "react";
import { Nav } from "react-bootstrap";
import { type ChartDocument, type PBScoreDocument, type ScoreDocument } from "tachi-common";

type LampTypes = "Easy" | "EXHard" | "Hard" | "Normal";

export function BMSGraphsComponent({
	score,
}: {
	chart: ChartDocument<"bms-7k" | "bms-14k">;
	score: PBScoreDocument<"bms-7k" | "bms-14k"> | ScoreDocument<"bms-7k" | "bms-14k">;
}) {
	const [lamp, setLamp] = useState<LampTypes>(LampToKey(score));

	let gaugeStatus: "gas" | "none" | "single" = "none";

	if (
		score.scoreData.optional.gaugeHistoryEasy &&
		score.scoreData.optional.gaugeHistoryGroove &&
		score.scoreData.optional.gaugeHistoryHard
	) {
		gaugeStatus = "gas";
	} else if (score.scoreData.optional.gaugeHistory) {
		gaugeStatus = "single";
	}

	const shouldDisable = (r: LampTypes) => {
		if (gaugeStatus === "gas") {
			return false;
		} else if (gaugeStatus === "single") {
			return r !== LampToKey(score);
		}

		return true;
	};

	useEffect(() => {
		setLamp(LampToKey(score));
	}, [score]);

	const gaugeHistory = (() => {
		switch (gaugeStatus) {
			case "gas":
				return (() => {
					switch (lamp) {
						case "Normal":
							return score.scoreData.optional.gaugeHistoryGroove!;
						case "Easy":
							return score.scoreData.optional.gaugeHistoryEasy!;
						case "Hard":
							return score.scoreData.optional.gaugeHistoryHard!;
						case "EXHard":
							return null;
					}
				})();
			case "single":
				return score.scoreData.optional.gaugeHistory!;
			case "none":
				return null;
		}
	})();

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					<SelectNav
						disabled={shouldDisable("Easy")}
						id="Easy"
						setValue={setLamp}
						value={lamp}
					>
						Easy
					</SelectNav>
					<SelectNav
						disabled={shouldDisable("Normal")}
						id="Normal"
						setValue={setLamp}
						value={lamp}
					>
						Groove
					</SelectNav>
					<SelectNav
						disabled={shouldDisable("Hard")}
						id="Hard"
						setValue={setLamp}
						value={lamp}
					>
						Hard
					</SelectNav>
					<SelectNav
						disabled={shouldDisable("EXHard")}
						id="EXHard"
						setValue={setLamp}
						value={lamp}
					>
						Ex Hard
					</SelectNav>
				</Nav>
			</div>
			<div className="col-12">
				{gaugeHistory ? (
					<GraphComponent type={lamp} values={gaugeHistory} />
				) : (
					<div
						className="d-flex align-items-center justify-content-center"
						style={{ height: "200px" }}
					>
						<span className="text-body-secondary">No gauge data :(</span>
					</div>
				)}
			</div>
		</>
	);
}

function GraphComponent({ type, values }: { type: LampTypes; values: (number | null)[] }) {
	return (
		<IIDXLampChart
			data={[
				{
					id: type,
					// x is from 0 -> 1_000; the percentXAxis function divides by 100
					// so we want this to be out of 10_000.
					data: values.map((e, i) => ({ x: i * 10, y: e ?? 0 })),
				},
			]}
			height="200px"
			mobileHeight="175px"
			type={type}
			usePercentXAxis
		/>
	);
}

function LampToKey(
	score: PBScoreDocument<"bms-7k" | "bms-14k"> | ScoreDocument<"bms-7k" | "bms-14k">,
): LampTypes {
	const lamp = score.scoreData.lamp;

	if (IsScore(score) && score.scoreMeta.gauge) {
		switch (score.scoreMeta.gauge) {
			case "EASY":
				return "Easy";
			case "NORMAL":
				return "Normal";
			case "HARD":
				return "Hard";
			case "EX-HARD":
				return "EXHard";
		}
	}

	if (lamp === "CLEAR") {
		return "Normal";
	} else if (lamp === "EASY CLEAR") {
		return "Easy";
	} else if (lamp === "HARD CLEAR") {
		return "Hard";
	} else if (lamp === "EX HARD CLEAR") {
		return "EXHard";
	} else if (lamp === "FULL COMBO") {
		// @hack - attempt to guess what gauge they used?
		if ((score.scoreData.optional.gaugeHistory?.[0] ?? 0) > 22) {
			return "EXHard";
		}
		return "Normal";
	} else if (lamp === "NO PLAY") {
		// dan gauge looks like this
		return "Hard";
	}

	return "Normal";
}
