import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatMillions, FormatScoreRating } from "#util/misc";
import React from "react";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

import MiniTable from "../components/MiniTable";
import LampCell from "./LampCell";

const CoreCell = ({ ratingValue }: { ratingValue: number }) => (
	<td>
		<div className="underline-on-hover">
			{FormatScoreRating("ongeki", "scoreRating", ratingValue)}
		</div>
	</td>
);

export default function OngekiScoreRatingCell({
	score,
}: {
	score: PBScoreDocument<"ongeki"> | ScoreDocument<"ongeki">;
}) {
	const ratingValue = score.calculatedData.scoreRating ?? 0;
	const noteLamp = score.scoreData.noteLamp;
	const bellLamp = score.scoreData.bellLamp;
	const grade = score.scoreData.grade;

	const gradeColor = ChangeOpacity(
		GPT_CLIENT_IMPLEMENTATIONS.ongeki.enumColours.grade[score.scoreData.grade],
		0.2,
	);

	const gradeRating = grade === "SSS+" ? 0.3 : grade === "SSS" ? 0.2 : grade === "SS" ? 0.1 : 0;
	const noteRating =
		noteLamp === "ALL BREAK+"
			? 0.35
			: noteLamp === "ALL BREAK"
				? 0.3
				: noteLamp === "FULL COMBO"
					? 0.1
					: 0;
	const bellRating = bellLamp === "FULL BELL" ? 0.05 : 0;
	const techRating = ratingValue === 0 ? 0 : ratingValue - gradeRating - noteRating - bellRating;

	if (techRating <= 0) {
		// This value is N/A if techRating isn't positive
		return <CoreCell ratingValue={ratingValue} />;
	}

	return (
		<>
			<QuickTooltip
				tooltipContent={
					<>
						<MiniTable headers={["Result", "Rating"]}>
							<tr>
								<td
									style={{
										backgroundColor: gradeColor,
									}}
								>
									{FormatMillions(score.scoreData.score)}
								</td>
								<td>{techRating.toFixed(3)}</td>
							</tr>
							<tr>
								<LampCell
									colour={
										GPT_CLIENT_IMPLEMENTATIONS.ongeki.enumColours.noteLamp[
											noteLamp
										]
									}
									lamp={noteLamp}
								/>
								<td>{noteRating.toFixed(3)}</td>
							</tr>
							<tr>
								<LampCell
									colour={
										GPT_CLIENT_IMPLEMENTATIONS.ongeki.enumColours.bellLamp[
											bellLamp
										]
									}
									lamp={bellLamp}
								/>
								<td>{bellRating.toFixed(3)}</td>
							</tr>
							<tr>
								<td
									style={{
										backgroundColor: gradeColor,
									}}
								>
									<strong>{score.scoreData.grade}</strong>
								</td>
								<td>{gradeRating.toFixed(3)}</td>
							</tr>
						</MiniTable>
					</>
				}
				wide
			>
				<CoreCell ratingValue={ratingValue} />
			</QuickTooltip>
		</>
	);
}
