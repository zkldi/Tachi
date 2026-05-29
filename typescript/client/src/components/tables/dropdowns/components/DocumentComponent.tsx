import TimestampCell from "#components/tables/cells/TimestampCell";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { UserContext } from "#context/UserContext";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type UGPTChartPBComposition } from "#types/api-returns";
import { type SetState } from "#types/react";
import { IsScore } from "#util/asserts";
import { FormatGPTProfileRatingName } from "#util/misc";
import React, { useContext, useEffect, useState } from "react";
import { type ChartDocument, type PBScoreDocument, type ScoreDocument } from "tachi-common";

import CommentContainer from "./CommentContainer";
import DeleteScoreBtn from "./DeleteScoreBtn";
import JudgementTable from "./JudgementTable";
import PBNote from "./PBNote";
import ScoreEditButtons from "./ScoreEditButtons";

export function ScoreInfo({
	score,
	chart,
}: {
	chart: ChartDocument;
	score: PBScoreDocument | ScoreDocument;
}) {
	const game = score.game;
	const rating = useScoreRatingAlg(game);
	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	return (
		<div className="col-12">
			<table className="table">
				<thead>
					<tr>
						<td colSpan={gptImpl.scoreHeaders.length}>Score Info</td>
						<td>{FormatGPTProfileRatingName(game, rating)}</td>
						<td>Timestamp</td>
					</tr>
				</thead>
				<tbody>
					<tr>
						<ScoreCoreCells chart={chart} game={game} rating={rating} score={score} />
						<TimestampCell
							game={game}
							/* @ts-expect-error yeah we know service doesnt necessarily exist */
							service={score?.service}
							time={score.timeAchieved}
						/>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

export interface ScoreState {
	highlight: boolean;
	setHighlight: SetState<boolean>;
}

export type DocumentComponentType = typeof DocumentComponent;

export default function DocumentComponent({
	score,
	scoreState,
	renderScoreInfo = true,
	showSingleScoreNote = false,
	GraphComponent = null,
	forceScoreData = false,
	pbData,
	chart,
	onScoreUpdate,
}: {
	chart: ChartDocument;
	forceScoreData?: boolean;
	GraphComponent?:
		| (({
				score,
				chart,
		  }: {
				chart: ChartDocument;
				score: PBScoreDocument | ScoreDocument;
		  }) => JSX.Element)
		| null;
	onScoreUpdate?: (sc: ScoreDocument) => void;
	pbData: UGPTChartPBComposition;
	renderScoreInfo?: boolean;
	score: PBScoreDocument | ScoreDocument;
	scoreState: {
		highlight: boolean;
		setComment?: SetState<string | null>;
		setHighlight: SetState<boolean>;
	};
	showSingleScoreNote?: boolean;
}) {
	const [comment, setComment] = useState(IsScore(score) ? score.comment : null);

	useEffect(() => {
		setComment(IsScore(score) ? score.comment : null);
	}, [score]);

	useEffect(() => {
		// what kind of crack was i smoking here?
		scoreState.setComment?.(comment);
	}, [comment]);

	const { user } = useContext(UserContext);
	const isAuthorised = user && (user.id === score.userID || user.authLevel === 3);

	return (
		<div className="w-100 h-100 mb-0 d-flex" style={{ gap: "10px" }}>
			<div style={{ flex: 9 }}>
				<div className="row h-100 justify-content-center">
					{GraphComponent ? (
						<GraphComponent chart={chart} score={score} />
					) : (
						<div
							className="d-flex align-items-center justify-content-center"
							style={{ height: "200px" }}
						>
							<span className="text-body-secondary">No graphs available :(</span>
						</div>
					)}

					{IsScore(score) ? (
						<>
							{renderScoreInfo && !showSingleScoreNote && (
								<ScoreInfo chart={chart} score={score} />
							)}
							<CommentContainer comment={comment} />
							{showSingleScoreNote && (
								<div className="col-12">
									<PBNote />
									<br />
									<small>
										In this case, your best lamp and your best score were the
										same!
									</small>
								</div>
							)}
							<ScoreEditButtons
								onScoreUpdate={onScoreUpdate}
								score={score}
								scoreState={{ ...scoreState, comment, setComment }}
							/>
						</>
					) : (
						<div className="col-12 align-self-end">
							{forceScoreData && !showSingleScoreNote && (
								<ScoreInfo chart={chart} score={score} />
							)}
							<CommentContainer
								comment={pbData.scores
									.map((e) => e.comment)
									.filter((e) => e !== null)
									.join("; ")}
							/>
							<PBNote />
						</div>
					)}
				</div>
			</div>
			<div className="m-4" style={{ flex: 3 }}>
				<div
					className="h-100 d-flex"
					style={{ flexDirection: "column", justifyContent: "space-between" }}
				>
					<div className="my-auto">
						<JudgementTable score={score} />
					</div>

					{IsScore(score) && isAuthorised && (
						<div>
							<DeleteScoreBtn score={score} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export function GraphAndJudgementDataComponent({
	score,
	GraphComponent = null,
	chart,
}: {
	chart: ChartDocument;
	forceScoreData?: boolean;
	GraphComponent?:
		| (({
				score,
				chart,
		  }: {
				chart: ChartDocument;
				score: PBScoreDocument | ScoreDocument;
		  }) => JSX.Element)
		| null;
	renderScoreInfo?: boolean;
	score: PBScoreDocument | ScoreDocument;
	showSingleScoreNote?: boolean;
}) {
	return (
		<div className="row w-100">
			<div className="col-9">
				<div className="row h-100 justify-content-center">
					{GraphComponent ? (
						<GraphComponent chart={chart} score={score} />
					) : (
						<div
							className="d-flex align-items-center justify-content-center"
							style={{ height: "200px" }}
						>
							<span className="text-body-secondary">No graphs available :(</span>
						</div>
					)}
				</div>
			</div>
			<div className="col-3 align-self-center">
				<JudgementTable score={score} />
			</div>
		</div>
	);
}
