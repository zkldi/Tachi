import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { UserContext } from "#context/UserContext";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { IsNullish } from "#util/misc";
import { useContext } from "react";
import { PoyashiBPI } from "rg-stats";
import {
	type ChartDocument,
	type GamesForGroup,
	IIDXLIKE_GBOUNDARIES,
	IIDXLikeGetGrade,
	type integer,
	type PBScoreDocument,
	type ScoreDocument,
} from "tachi-common";

import MiniTable from "../components/MiniTable";
import DeltaCell from "./DeltaCell";
import ScoreCell from "./ScoreCell";

export default function BPICell({
	score,
	chart,
}: {
	chart: ChartDocument<GamesForGroup["iidx"]>;
	score: PBScoreDocument<GamesForGroup["iidx"]> | ScoreDocument<GamesForGroup["iidx"]>;
}) {
	const { user } = useContext(UserContext);
	const { settings } = useLoggedInUserGameSettings<GamesForGroup["iidx"]>();

	const bpi = score.calculatedData.BPI;
	const { kaidenAverage, worldRecord, notecount, bpiCoefficient } = chart.data;

	if (IsNullish(score.calculatedData.BPI) || IsNullish(kaidenAverage) || IsNullish(worldRecord)) {
		return <td>N/A</td>;
	}

	const isRequestingUser = user?.id === score.userID;
	const bpiTarget = settings?.preferences.gameSpecific.bpiTarget ?? 0;
	let bpiTargetScore = 0;
	let targetDelta: number | null = 0;

	try {
		bpiTargetScore = PoyashiBPI.inverse(
			bpiTarget,
			kaidenAverage!,
			worldRecord!,
			notecount * 2,
			bpiCoefficient,
		);

		targetDelta = score.scoreData.score - bpiTargetScore;
	} catch (err) {
		console.warn(err);
		// Wasn't possible to get this BPI!
	}

	const kavgDelta = score.scoreData.score - kaidenAverage!;

	const iidxPlaytype: "DP" | "SP" = chart.game === "iidx-sp" ? "SP" : "DP";

	const { score: WRAverageCell, delta: WRDeltaCell } = FormatAverage(
		worldRecord!,
		iidxPlaytype,
		chart.data.notecount,
	);

	const { score: KDAverageCell, delta: KDDeltaCell } = FormatAverage(
		kaidenAverage!,
		iidxPlaytype,
		chart.data.notecount,
	);

	const showTargetColumn = isRequestingUser && bpiTarget !== 0;

	const targetFmt = showTargetColumn
		? FormatAverage(bpiTargetScore, iidxPlaytype, chart.data.notecount)
		: null;

	const headers = ["皆伝 Average", "World Record"];

	if (showTargetColumn) {
		headers.unshift(`Your Target (BPI ${bpiTarget})`);
	}

	const tooltipTable = (
		<div className="bpi-tooltip-stack text-center">
			<MiniTable headers={headers}>
				<tr>
					{showTargetColumn && targetFmt ? targetFmt.score : null}
					{KDAverageCell}
					{WRAverageCell}
				</tr>
				<tr>
					{showTargetColumn && targetFmt ? targetFmt.delta : null}
					{KDDeltaCell}
					{WRDeltaCell}
				</tr>
			</MiniTable>
			<Divider className="my-2" />
			<Muted>
				BPI Coefficient:{" "}
				{IsNullish(chart.data.bpiCoefficient) || chart.data.bpiCoefficient === -1
					? 1.175
					: chart.data.bpiCoefficient}
			</Muted>
		</div>
	);

	return (
		<td>
			<QuickTooltip tooltipContent={tooltipTable} wide>
				<span className="cursor-default d-inline-block w-100">
					<strong className="underline-on-hover">{bpi?.toFixed(2)}</strong>
					<br />

					<div>
						{isRequestingUser ? (
							<>
								<BPITargetCell bpiTarget={bpiTarget} targetDelta={targetDelta} />
								{bpiTarget !== 0 && (
									<>
										<br />
										<Muted>
											皆伝{kavgDelta < 0 ? kavgDelta : `+${kavgDelta}`}
										</Muted>
									</>
								)}
							</>
						) : (
							<>
								<Muted>皆伝{kavgDelta < 0 ? kavgDelta : `+${kavgDelta}`}</Muted>
							</>
						)}
					</div>
				</span>
			</QuickTooltip>
		</td>
	);
}

function FormatAverage(exScore: integer, playtype: "DP" | "SP", notecount: integer) {
	const percent = notecount > 0 ? (100 * exScore) / (notecount * 2) : 0;

	const grade = IIDXLikeGetGrade(exScore, notecount);

	const iidxGame = playtype === "SP" ? "iidx-sp" : "iidx-dp";

	const formatNumFn =
		percent > 0
			? (deltaPercent: number) => {
					const maxPts = Math.floor(exScore / (percent / 100));
					const v = (deltaPercent / 100) * maxPts;

					return Math.round(v).toFixed(0);
				}
			: (deltaPercent: number) => deltaPercent.toFixed(2);

	return {
		score: (
			<ScoreCell
				colour={GAME_CLIENT_IMPLEMENTATIONS[iidxGame].enumColours.grade[grade]}
				grade={grade}
				percent={percent}
				score={exScore}
			/>
		),
		delta: (
			<DeltaCell
				formatNumFn={formatNumFn}
				grade={grade}
				gradeBoundaries={IIDXLIKE_GBOUNDARIES}
				value={percent}
			/>
		),
	};
}

function BPITargetCell({
	targetDelta,
	bpiTarget,
}: {
	bpiTarget: number;
	targetDelta: number | null;
}) {
	if (targetDelta === null) {
		return <small>BPI{bpiTarget} Not Possible</small>;
	}

	let tag = `${bpiTarget}BPI `;

	if (bpiTarget === 0) {
		tag = "皆伝";
	} else if (bpiTarget === 100) {
		tag = "WR";
	}

	return (
		<small
			className={
				targetDelta < 0
					? "text-danger"
					: targetDelta === 0
						? "text-warning"
						: "text-success"
			}
		>
			{tag}
			{targetDelta < 0 ? targetDelta : `+${targetDelta}`}
		</small>
	);
}
