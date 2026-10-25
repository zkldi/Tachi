import TimestampCell from "#components/tables/cells/TimestampCell";
import MobileScoreRow from "#components/tables/components/MobileScoreRow";
import mobileTableStyles from "#components/tables/components/MobileTable.module.scss";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import useScoreRatingAlg from "#components/util/useScoreRatingAlg";
import { UserContext } from "#context/UserContext";
import { WindowContext } from "#context/WindowContext";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type UserGameChartPBComposition } from "#types/api-returns";
import { type SetState } from "#types/react";
import { IsScore } from "#util/asserts";
import { FormatGameProfileRatingName } from "#util/misc";
import { useContext, useEffect, useState } from "react";
import { type ChartDocument, type PBScoreDocument, type ScoreDocument } from "tachi-common";

import CommentContainer from "./CommentContainer";
import DeleteScoreBtn from "./DeleteScoreBtn";
import JudgementTable from "./JudgementTable";
import PBNote from "./PBNote";
import styles from "./ScoreDetails.module.scss";
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
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);

	if (!isLg) {
		return (
			<div className="col-12">
				<table aria-label="Score information" className={mobileTableStyles.entries}>
					<tbody>
						<MobileScoreRow
							chart={chart}
							game={game}
							rating={rating}
							score={score}
							showChart={false}
						/>
					</tbody>
				</table>
			</div>
		);
	}

	return (
		<div className={`col-12 ${styles.scoreInfo}`}>
			<table className="table">
				<thead>
					<tr>
						<td colSpan={gptImpl.scoreHeaders.length}>Score Info</td>
						<td>{FormatGameProfileRatingName(game, rating)}</td>
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
	pbData: UserGameChartPBComposition;
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
		<div className={styles.document}>
			<div className={styles.documentMain}>
				<div className={`row justify-content-center ${styles.mainContent}`}>
					{GraphComponent ? (
						<GraphComponent chart={chart} score={score} />
					) : (
						<div className={styles.emptyGraph}>No graphs available :(</div>
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
			<div className={styles.documentAside}>
				<JudgementTable score={score} />

				{IsScore(score) && isAuthorised && (
					<div>
						<DeleteScoreBtn score={score} />
					</div>
				)}
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
		<div className={styles.document}>
			<div className={styles.documentMain}>
				<div className={`row justify-content-center ${styles.mainContent}`}>
					{GraphComponent ? (
						<GraphComponent chart={chart} score={score} />
					) : (
						<div className={styles.emptyGraph}>No graphs available :(</div>
					)}
				</div>
			</div>
			<div className={styles.documentAside}>
				<JudgementTable score={score} />
			</div>
		</div>
	);
}
