import Icon from "#components/util/Icon";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { FormatGameScoreRatingName } from "#util/misc";
import { FormatTime, MillisToSince } from "#util/time";
import { type CSSProperties, type ReactNode, useState } from "react";
import {
	type AnyScoreRatingAlg,
	type ChartDocument,
	type PBScoreDocument,
	type ScoreDocument,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import DifficultyCell from "../cells/DifficultyCell";
import TitleCell from "../cells/TitleCell";
import UserCell from "../cells/UserCell";
import ScoreCoreCells from "../game-core-cells/ScoreCoreCells";
import styles from "./MobileTable.module.scss";

export default function MobileScoreRow({
	chart,
	song,
	score,
	game,
	rating,
	dropdown,
	index,
	user,
	highlight = false,
	comment,
	showChart = true,
	extraCells,
	extraLabels = [],
}: {
	chart: ChartDocument;
	comment?: string | null;
	dropdown?: ReactNode;
	extraCells?: ReactNode;
	extraLabels?: string[];
	game: V3Game;
	highlight?: boolean;
	index?: number;
	rating: AnyScoreRatingAlg;
	score: PBScoreDocument | ScoreDocument | null;
	showChart?: boolean;
	song?: SongDocument;
	user?: UserDocument;
}) {
	const [expanded, setExpanded] = useState(false);
	const coreHeaders = GAME_CLIENT_IMPLEMENTATIONS[game].scoreHeaders;
	const labels = [
		...coreHeaders.map(([name, shortName]) => shortName || name),
		FormatGameScoreRatingName(game, rating),
		...extraLabels,
	];
	const metricStyle = {
		...Object.fromEntries(
			labels.map((label, index) => [`--metric-label-${index + 1}`, JSON.stringify(label)]),
		),
		...Object.fromEntries(
			coreHeaders.map(([name], index) => [
				`--metric-width-${index + 1}`,
				name.toLowerCase().includes("judgement") ? "130px" : "68px",
			]),
		),
		"--secondary-width": `${100 / (extraLabels.length + 1)}%`,
	} as CSSProperties;
	const time = score?.timeAchieved;

	return (
		<tr className={styles.entry}>
			<td>
				<article className={highlight ? styles.highlighted : undefined}>
					<div className={styles.heading}>
						<table className={styles.chart}>
							<tbody>
								<tr>
									{showChart && <DifficultyCell chart={chart} game={game} />}
									{showChart && song && (
										<TitleCell
											chart={chart}
											comment={comment}
											game={game}
											song={song}
										/>
									)}
									{!showChart && user && (
										<UserCell
											game={game}
											showProfilePicture={false}
											user={user}
										/>
									)}
								</tr>
							</tbody>
						</table>
					</div>
					{showChart && user && (
						<table className={styles.user}>
							<tbody>
								<tr>
									<UserCell game={game} showProfilePicture={false} user={user} />
								</tr>
							</tbody>
						</table>
					)}
					{score ? (
						<table
							className={styles.metrics}
							data-core-count={coreHeaders.length}
							style={metricStyle}
						>
							<thead className="visually-hidden">
								<tr>
									{labels.map((label, index) => (
										<th key={index} scope="col">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								<tr>
									<ScoreCoreCells
										chart={chart}
										game={game}
										rating={rating}
										score={score}
									/>
									{extraCells}
								</tr>
							</tbody>
						</table>
					) : (
						<div className={styles.unplayed}>Not Played.</div>
					)}
					<footer className={styles.footer}>
						<span>
							{index !== undefined && (
								<span className={styles.index}>#{index + 1}</span>
							)}
							{time ? (
								<time dateTime={new Date(time).toISOString()}>
									{MillisToSince(time)} · {FormatTime(time)}
								</time>
							) : (
								"No timestamp"
							)}
						</span>
						{dropdown && (
							<button
								aria-expanded={expanded}
								onClick={() => setExpanded(!expanded)}
								type="button"
							>
								Details <Icon type={expanded ? "angle-up" : "angle-down"} />
							</button>
						)}
					</footer>
					{expanded && <div className={styles.dropdown}>{dropdown}</div>}
				</article>
			</td>
		</tr>
	);
}
