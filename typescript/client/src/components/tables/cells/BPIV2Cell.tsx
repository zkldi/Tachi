import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { UserContext } from "#context/UserContext";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { IsNullish } from "#util/misc";
import { useContext } from "react";
import { PoyashiBPI2 } from "rg-stats";
import {
	type ChartDocument,
	IIDXLIKE_GBOUNDARIES,
	IIDXLikeGetGrade,
	type integer,
	type PBScoreDocument,
	type ScoreDocument,
} from "tachi-common";

import MiniTable from "../components/MiniTable";
import DeltaCell from "./DeltaCell";
import ScoreCell from "./ScoreCell";

export default function BPIV2Cell({
	score,
	chart,
}: {
	chart: ChartDocument<"iidx-sp">;
	score: PBScoreDocument<"iidx-sp"> | ScoreDocument<"iidx-sp">;
}) {
	const { user } = useContext(UserContext);
	const { settings } = useLoggedInUserGameSettings<"iidx-sp">();

	const bpi = score.calculatedData.BPI;
	const { bpi2Mu, bpi2Sigma, kaidenAverage, worldRecord, notecount, bpiCoefficient } = chart.data;

	if (IsNullish(bpi) || IsNullish(worldRecord) || IsNullish(bpi2Mu) || IsNullish(bpi2Sigma)) {
		return <td>N/A</td>;
	}

	const isRequestingUser = user?.id === score.userID;
	const bpiTarget = settings?.preferences.gameSpecific.bpiTarget ?? 0;
	let bpiTargetScore: number | null = null;
	let targetDelta: number | null = null;

	try {
		bpiTargetScore = PoyashiBPI2.inverse(bpiTarget, {
			notecount,
			worldRecord,
			coefficient: bpiCoefficient,
			mu: bpi2Mu,
			sigma: bpi2Sigma,
		});
		targetDelta = score.scoreData.score - bpiTargetScore;
	} catch (err) {
		console.warn(err);
		// Wasn't possible to get this BPI!
	}

	const kavgDelta = IsNullish(kaidenAverage) ? null : score.scoreData.score - kaidenAverage;
	const wrFmt = FormatAverage(worldRecord, notecount);
	const kaidenFmt = IsNullish(kaidenAverage) ? null : FormatAverage(kaidenAverage, notecount);
	const showTargetColumn = isRequestingUser && bpiTarget !== 0;
	const targetFmt =
		showTargetColumn && bpiTargetScore !== null
			? FormatAverage(bpiTargetScore, notecount)
			: null;
	const headers = kaidenFmt ? ["皆伝 Average", "World Record"] : ["World Record"];

	if (showTargetColumn) {
		headers.unshift(`Your Target (BPI ${bpiTarget})`);
	}

	const tooltipTable = (
		<div className="bpi-tooltip-stack text-center">
			<MiniTable headers={headers}>
				<tr>
					{showTargetColumn && targetFmt ? targetFmt.score : null}
					{kaidenFmt?.score}
					{wrFmt.score}
				</tr>
				<tr>
					{showTargetColumn && targetFmt ? targetFmt.delta : null}
					{kaidenFmt?.delta}
					{wrFmt.delta}
				</tr>
			</MiniTable>
			<Divider className="my-2" />
			<Muted>
				BPI Coefficient:{" "}
				{IsNullish(bpiCoefficient)
					? PoyashiBPI2.MODEL_CONSTANTS.coefMedian
					: bpiCoefficient}
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
										{!IsNullish(kavgDelta) && (
											<Muted>
												皆伝{kavgDelta < 0 ? kavgDelta : `+${kavgDelta}`}
											</Muted>
										)}
									</>
								)}
							</>
						) : (
							<>
								{!IsNullish(kavgDelta) && (
									<Muted>皆伝{kavgDelta < 0 ? kavgDelta : `+${kavgDelta}`}</Muted>
								)}
							</>
						)}
					</div>
				</span>
			</QuickTooltip>
		</td>
	);
}

function FormatAverage(exScore: integer, notecount: integer) {
	const percent = notecount > 0 ? (100 * exScore) / (notecount * 2) : 0;

	const grade = IIDXLikeGetGrade(exScore, notecount);

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
				colour={GAME_CLIENT_IMPLEMENTATIONS["iidx-sp"].enumColours.grade[grade]}
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

	const tag = `${bpiTarget}BPI `;

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
