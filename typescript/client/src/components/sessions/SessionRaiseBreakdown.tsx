import DifficultyCell from "#components/tables/cells/DifficultyCell";
import TitleCell from "#components/tables/cells/TitleCell";
import MiniTable from "#components/tables/components/MiniTable";
import {
	CommentModal,
	ModifyScore,
} from "#components/tables/dropdowns/components/ScoreEditButtons";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import SelectButton from "#components/util/SelectButton";
import { UserContext } from "#context/UserContext";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GPTClientImplementation } from "#lib/types";
import { type SessionReturns } from "#types/api-returns";
import { APIFetchV1 } from "#util/api";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartMap, CreateScoreIDMap, CreateSongMap } from "#util/data";
import { Reverse, UppercaseFirst } from "#util/misc";
import deepmerge from "deepmerge";
import { cloneDeep } from "lodash";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import {
	type ChartDocument,
	type GameConfig,
	GetGameConfig,
	GetScoreMetricConf,
	GetScoreMetrics,
	type ScoreDocument,
	type SessionScoreInfo,
	type SongDocument,
	type TableDocument,
	type V3Game,
} from "tachi-common";
import { type ConfEnumScoreMetric } from "tachi-common/types/metrics";

type SetScores = (scores: ScoreDocument[]) => void;

const Plural = (str: string) => str + (str.trimEnd().endsWith("s") ? "" : "s");

const FormatEnumTitle = (str: string) =>
	Plural(UppercaseFirst(str))
		.split(/(?=[A-Z])/u)
		.join("\u00a0"); // nbsp

export default function SessionRaiseBreakdown({
	sessionData,
	setScores,
	noHeader,
}: {
	noHeader?: boolean;
	sessionData: SessionReturns;
	setScores?: SetScores;
}) {
	const game = sessionData.session.game;
	const gameConfig = GetGameConfig(game);
	const enumMetrics = GetScoreMetrics(gameConfig, "ENUM");
	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	const { user } = useContext(UserContext);

	const { data, error } = useQuery(`/games/${game}/tables`, async () => {
		const res = await APIFetchV1<TableDocument[]>(`/games/${game}/tables`);

		if (!res.success) {
			throw new Error(res.description);
		}

		return res.body;
	});

	// null -> view all in small format
	// string -> view this specific metric.
	const [view, setView] = useState<string | null>(null);

	if (error) {
		return <>{(error as Error).message}</>;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<>
			{!noHeader && (
				<div className="col-12">
					<div className="row">
						<div className="col-12 col-lg-6 offset-lg-3">
							<div className="d-none d-lg-flex justify-content-center">
								<div className="btn-group">
									<SelectButton id={null} setValue={setView} value={view}>
										<Icon type="bolt" /> All
									</SelectButton>
									{enumMetrics.map((metric) => (
										<SelectButton
											id={metric}
											key={metric}
											setValue={setView}
											value={view}
										>
											{/* @ts-expect-error ctrl+f `enumIcons[` - standard procedure */}
											<Icon type={gptImpl.enumIcons[metric] ?? "lightbulb"} />{" "}
											{FormatEnumTitle(metric)}
										</SelectButton>
									))}
								</div>
							</div>
						</div>
					</div>

					<Divider className="mt-4 mb-4" />

					{user?.id === sessionData.user.id && (
						<div className="d-lg-block d-none mb-4">
							Tip: You can click on scores to highlight/add comments!
						</div>
					)}
				</div>
			)}
			<SessionScoreStatBreakdown {...{ sessionData, view, setScores }} />
		</>
	);
}

function SessionScoreStatBreakdown({
	sessionData,
	view,
	setScores,
}: {
	sessionData: SessionReturns;
	setScores?: SetScores;
	view: string | null;
}) {
	const songMap = CreateSongMap(sessionData.songs);
	const chartMap = CreateChartMap(sessionData.charts);
	const scoreMap = CreateScoreIDMap(sessionData.scores);
	const game = sessionData.session.game;
	const gameConfig = GetGameConfig(game);

	const enumMetrics = GetScoreMetrics(gameConfig, "ENUM");

	type Datapoint = { score: ScoreDocument; scoreInfo: SessionScoreInfo };
	const newEnums = useMemo(() => {
		const newEnums: Record<string, Record<string, Array<Datapoint>>> = {};

		for (const metric of enumMetrics) {
			newEnums[metric] = {};

			const highestMetric: Record<string, Datapoint> = {};

			for (const scoreInfo of sessionData.scoreInfo) {
				const score = scoreMap.get(scoreInfo.scoreID);

				if (!score) {
					console.error(
						`Session score info contains scoreID ${scoreInfo.scoreID}, but no score exists?`,
					);
					continue;
				}

				if (!scoreInfo.isNewScore && scoreInfo.deltas[metric] <= 0) {
					// not a raise
					continue;
				}

				if (highestMetric[score.chartID]) {
					const prevScore = highestMetric[score.chartID].score;

					// trumps previous score
					if (
						// @ts-expect-error yeah this is fine pls
						prevScore.scoreData.enumIndexes[metric] <
						// @ts-expect-error yeah this is fine pls
						score.scoreData.enumIndexes[metric]
					) {
						highestMetric[score.chartID] = { score, scoreInfo };
					}
				} else {
					highestMetric[score.chartID] = { score, scoreInfo };
				}
			}

			for (const s of Object.values(highestMetric)) {
				// @ts-expect-error bad metric type
				const enumValue = s.score.scoreData[metric];

				if (newEnums[metric][enumValue]) {
					newEnums[metric][enumValue].push(s);
				} else {
					newEnums[metric][enumValue] = [s];
				}
			}
		}

		return newEnums;
	}, [view]);

	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	return (
		<>
			{view === null ? (
				<div
					className="session-raise-container"
					style={{
						gap: "20px",
					}}
				>
					{enumMetrics.map((metric) => (
						<div key={metric} style={{ flex: 1 }}>
							<MiniTable
								className={enumMetrics.length > 2 ? "no-max-width" : ""}
								colSpan={[1, 100]}
								headers={[
									FormatEnumTitle(metric),
									`New ${FormatEnumTitle(metric)}`,
								]}
							>
								<ElementStatTable
									chartMap={chartMap}
									counts={newEnums[metric]!}
									game={game}
									gameConfig={gameConfig}
									gptImpl={gptImpl}
									metric={metric}
									scores={sessionData.scores}
									setScores={setScores}
									songMap={songMap}
								/>
							</MiniTable>
						</div>
					))}
				</div>
			) : (
				<div className="col-12">
					<MiniTable
						colSpan={[1, 100]}
						headers={[`${FormatEnumTitle(view)}`, `New ${FormatEnumTitle(view)}`]}
					>
						<ElementStatTable
							chartMap={chartMap}
							counts={newEnums[view]!}
							fullSize
							game={game}
							gameConfig={gameConfig}
							gptImpl={gptImpl}
							metric={view}
							scores={sessionData.scores}
							setScores={setScores}
							songMap={songMap}
						/>
					</MiniTable>
				</div>
			)}
		</>
	);
}

function ElementStatTable({
	metric: metric,
	counts,
	gameConfig,
	songMap,
	chartMap,
	game,
	fullSize = false,
	scores,
	setScores,
	gptImpl,
}: {
	chartMap: Map<string, ChartDocument<V3Game>>;
	counts: Record<string, { score: ScoreDocument; scoreInfo: SessionScoreInfo }[]>;
	fullSize?: boolean;
	game: V3Game;
	gameConfig: GameConfig;
	gptImpl: GPTClientImplementation<any>;
	metric: string;
	scores: ScoreDocument[];
	setScores?: SetScores;
	songMap: Map<string, SongDocument>;
}) {
	const tableContents = useMemo(() => {
		const conf = GetScoreMetricConf(gameConfig, metric) as ConfEnumScoreMetric<string>;

		// relements.. haha
		const relevantElements = conf.values.slice(conf.values.indexOf(conf.minimumRelevantValue));

		const colours = gptImpl.enumColours[metric];

		const tableContents = [];
		for (const element of Reverse(relevantElements)) {
			if (!counts[element] || !counts[element].length) {
				continue;
			}

			const firstData = counts[element][0];

			tableContents.push(
				<tr className="breakdown-hover-row" key={element}>
					<td
						rowSpan={counts[element]!.length}
						style={{
							backgroundColor: ChangeOpacity(colours[element], 0.1),
						}}
					>
						{element}
					</td>
					<BreakdownChartContents
						{...firstData}
						{...{
							chartMap,
							songMap,
							fullSize,
							game,
							gameConfig,
							metric: metric,
							scores,
							setScores,
						}}
					/>
				</tr>,
			);

			for (const data of counts[element]!.slice(1)) {
				tableContents.push(
					<tr className="breakdown-hover-row" key={data.score.scoreID}>
						<BreakdownChartContents
							{...data}
							{...{
								chartMap,
								songMap,
								fullSize,
								game,
								gameConfig,
								metric: metric,
								scores,
								setScores,
							}}
						/>
					</tr>,
				);
			}
		}

		return tableContents;
	}, [metric, counts, fullSize, game, scores]);

	if (tableContents.length === 0) {
		return (
			<tr>
				<td colSpan={3}>No Raises...</td>
			</tr>
		);
	}

	return <>{tableContents}</>;
}

function BreakdownChartContents({
	score,
	scoreInfo,
	game,
	songMap,
	chartMap,
	fullSize,
	gameConfig,
	metric,
	scores,
	setScores,
}: {
	chartMap: Map<string, ChartDocument<V3Game>>;
	fullSize: boolean;
	game: V3Game;
	gameConfig: GameConfig;
	metric: string;
	score: ScoreDocument;
	scoreInfo: SessionScoreInfo;
	scores: Array<ScoreDocument>;
	setScores?: SetScores;
	songMap: Map<string, SongDocument>;
}) {
	const modifyScore = useMemo(
		() =>
			(
				{ highlight, comment }: { comment?: string | null; highlight?: boolean },
				scores: ScoreDocument[],
				setScores: SetScores,
			) => {
				const scoreID = score.scoreID;

				ModifyScore(scoreID, { highlight, comment }).then((r) => {
					if (r) {
						const filtered = scores.filter((e) => e.scoreID !== scoreID);
						const newScore = { ...score };

						if (highlight !== undefined) {
							newScore.highlight = highlight;
						}
						if (comment !== undefined) {
							newScore.comment = comment;
						}

						setScores([...filtered, newScore]);
					}
				});
			},
		[score, scores, setScores],
	);

	const chart = chartMap.get(score.chartID)!;
	const song = songMap.get(score.songID)!;

	const { user } = useContext(UserContext);

	const [highlight, setHighlight] = useState(score.highlight);
	const [comment, setComment] = useState(score.comment);
	const [firstRun, setFirstRun] = useState(true);

	useEffect(() => {
		if (firstRun) {
			setFirstRun(false);
			return;
		}

		if (!setScores) {
			return;
		}

		modifyScore({ highlight, comment }, scores, setScores);
	}, [highlight, comment]);

	if (!chart || !song) {
		console.error(`No chart for ${score.chartID}/${score.songID}???`);
		return null;
	}

	if (fullSize) {
		const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[score.game];

		let preScoreCell = <td colSpan={gptImpl.scoreHeaders.length}>No Play</td>;

		if (!scoreInfo.isNewScore) {
			const newScoreData = cloneDeep(score.scoreData);

			for (const [k, d] of Object.entries(scoreInfo.deltas)) {
				// @ts-expect-error it'll be an enum
				if (typeof score.scoreData[k] === "string") {
					const enumConf = GetScoreMetricConf(
						gameConfig,
						k,
					) as ConfEnumScoreMetric<string>;

					// @ts-expect-error alter the enum
					const newIndex = score.scoreData.enumIndexes[k] - d;

					// @ts-expect-error alter the enum
					newScoreData.enumIndexes[k] = newIndex;
					// @ts-expect-error alter the enum
					newScoreData[k] = enumConf.values[newIndex] ?? "UNKNOWN ENUM ??";
				} else {
					// @ts-expect-error ugh
					newScoreData[k] = score.scoreData[k] - d;
				}
			}

			const mockScore = deepmerge(score, {
				scoreData: newScoreData,
			}) as ScoreDocument;

			// We don't actually know what the user's previous score was, we can only walk
			// back the raise information we have. As such, we don't keep track of
			// judgements, and must nix them here.
			mockScore.scoreData.judgements = {};

			preScoreCell = <ScoreCoreCells chart={chart} game={game} score={mockScore} short />;
		}

		if (score) {
			return (
				<>
					<TitleCell chart={chart} game={game} song={song} />
					<DifficultyCell alwaysShort chart={chart} game={game} />
					{preScoreCell}
					<td>⟶</td>
					<ScoreCoreCells chart={chart} game={game} score={score} short />
				</>
			);
		}
	}

	return (
		<>
			<TitleCell chart={chart} comment={comment} game={game} noArtist song={song} />
			<CommentHighlightManager
				comment={comment}
				highlight={highlight}
				// is the user looking at this session
				// and scores are settable
				isEditable={score.userID === user?.id && !!setScores}
				setComment={setComment}
				setHighlight={setHighlight}
			/>
			<DifficultyCell alwaysShort chart={chart} game={game} />
		</>
	);
}

/**
 * It manages the comment and highlight stuff.
 *
 * I don't know what else to call this function.
 */
function CommentHighlightManager({
	highlight,
	setHighlight,
	comment,
	setComment,
	isEditable,
}: {
	comment: string | null;
	highlight: boolean;
	isEditable: boolean;
	setComment: (cm: string | null) => void;
	setHighlight: (hl: boolean) => void;
}) {
	const [showCommentModal, setShowCommentModal] = useState(false);

	return (
		<td style={{ verticalAlign: "center" }}>
			<CommentModal
				initialComment={comment}
				onUpdate={(comment) => {
					setComment(comment);
					setShowCommentModal(false);
				}}
				setShow={setShowCommentModal}
				show={showCommentModal}
			/>
			{isEditable && (
				<span className="breakdown-hover-highlight-button">
					<Icon
						onClick={() => setShowCommentModal(true)}
						regular
						style={{ paddingTop: "0.1rem", paddingRight: "0.33rem" }}
						type="comment"
					/>
				</span>
			)}

			{isEditable ? (
				// editable, highlighted
				highlight ? (
					<Icon
						colour="warning"
						onClick={() => setHighlight(false)}
						style={{ paddingTop: "0.1rem", paddingRight: "0.33rem" }}
						type="star"
					/>
				) : (
					// editable, not highlighted
					<span className="breakdown-hover-highlight-button">
						<Icon
							onClick={() => setHighlight(true)}
							regular
							style={{ paddingTop: "0.1rem" }}
							type="star"
						/>
					</span>
				)
			) : (
				// non-editable, highlighted
				highlight && (
					<Icon
						colour="warning"
						style={{ paddingTop: "0.1rem", paddingRight: "0.33rem" }}
						type="star"
					/>
				)
			)}
		</td>
	);
}
