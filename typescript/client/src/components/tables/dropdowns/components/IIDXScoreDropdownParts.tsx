import IIDXLampChart from "#components/charts/IIDXLampChart";
import SelectNav from "#components/util/SelectNav";
import { IsScore } from "#util/asserts";
import React, { useEffect, useState } from "react";
import { Nav } from "react-bootstrap";
import { type GamesForGroup, type PBScoreDocument, type ScoreDocument } from "tachi-common";

// export function ModsTable({ score }: { score: ScoreDocument<"iidx:SP" | "iidx:DP"> }) {
// 	if (!score.scoreMeta.assist && !score.scoreMeta.random) {
// 		return null;
// 	}

// 	return (
// 		<MiniTable className="text-center table-sm" headers={["Mods"]} colSpan={2}>
// 			{score.scoreMeta.random && (
// 				<tr>
// 					<td>Note</td>
// 					<td>
// 						{Array.isArray(score.scoreMeta.random)
// 							? score.scoreMeta.random.join(" | ")
// 							: score.scoreMeta.random}
// 					</td>
// 				</tr>
// 			)}
// 			{score.scoreMeta.assist && (
// 				<tr>
// 					<td>Assist</td>
// 					<td>{score.scoreMeta.assist}</td>
// 				</tr>
// 			)}
// 		</MiniTable>
// 	);
// }

type LampTypes = "DAN_GAUGE" | "Easy" | "EXHard" | "Hard" | "Normal";

export function IIDXGraphsComponent({
	score,
}: {
	score: PBScoreDocument<GamesForGroup["iidx"]> | ScoreDocument<GamesForGroup["iidx"]>;
}) {
	const [lamp, setLamp] = useState<LampTypes>(LampToKey(score));

	let gaugeStatus: "gsm" | "none" | "single" = "none";

	if (
		score.scoreData.optional.gsmEXHard &&
		score.scoreData.optional.gsmHard &&
		score.scoreData.optional.gsmNormal &&
		score.scoreData.optional.gsmEasy
	) {
		gaugeStatus = "gsm";
	} else if (score.scoreData.optional.gaugeHistory) {
		gaugeStatus = "single";
	}

	const shouldDisable = (r: LampTypes) => {
		if (gaugeStatus === "gsm") {
			return false;
		} else if (gaugeStatus === "single") {
			return r !== LampToKey(score);
		}

		return true;
	};

	useEffect(() => {
		setLamp(LampToKey(score));
	}, [score]);

	return (
		<>
			<div className="col-12 d-flex justify-content-center">
				<Nav variant="pills">
					{score.scoreData.lamp === "NO PLAY" && (
						<SelectNav
							disabled={shouldDisable("DAN_GAUGE")}
							id="DAN_GAUGE"
							setValue={setLamp}
							value={lamp}
						>
							Dan Gauge
						</SelectNav>
					)}
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
						Normal
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
				{gaugeStatus === "gsm" && lamp !== "DAN_GAUGE" ? (
					<GraphComponent type={lamp} values={score.scoreData.optional[`gsm${lamp}`]!} />
				) : gaugeStatus === "single" ? (
					<GraphComponent type={lamp} values={score.scoreData.optional.gaugeHistory!} />
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
					data: values.map((e, i) => ({ x: i, y: e ?? 0 })),
				},
			]}
			height="200px"
			mobileHeight="175px"
			type={type}
		/>
	);
}

function LampToKey(
	score: PBScoreDocument<GamesForGroup["iidx"]> | ScoreDocument<GamesForGroup["iidx"]>,
): LampTypes {
	const lamp = score.scoreData.lamp;

	if (lamp === "NO PLAY") {
		return "DAN_GAUGE";
	}

	if (IsScore(score) && score.scoreMeta.gauge) {
		switch (score.scoreMeta.gauge) {
			case "EASY":
				return "Easy";
			case "NORMAL":
				return "Normal";
			case "HARD":
				return "Hard";
			case "ASSISTED EASY":
				return "Easy";
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
		// this could be hard or easy, we actually legitimately do not know in this scenario
		if ((score.scoreData.optional.gaugeHistory?.[0] ?? 0) > 22) {
			return "EXHard";
		}
		return "Normal";
	}

	return "Normal";
}
