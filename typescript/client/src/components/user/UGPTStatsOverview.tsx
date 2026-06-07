import ClassBadge from "#components/game/ClassBadge";
import QuickTooltip from "#components/layout/misc/QuickTooltip";
import MiniTable from "#components/tables/components/MiniTable";
import Divider from "#components/util/Divider";
import {
	FormatGPTProfileRating,
	FormatGPTProfileRatingName,
	FormatGPTScoreRatingName,
	getProfileRatingAlgRowStyle,
	sortProfileRatingEntries,
	UppercaseFirst,
} from "#util/misc";
import { StrSOV } from "#util/sorts";
import React from "react";
import { type Classes, GetGameConfig, type UserGameStats, type V3Game } from "tachi-common";

export default function UGPTRatingsTable({ ugs }: { ugs: UserGameStats }) {
	const game = ugs.game;
	const gameConfig = GetGameConfig(game);

	const ratings = sortProfileRatingEntries(
		game,
		Object.entries(ugs.ratings) as [string, number][],
	);

	return (
		<MiniTable className="table-sm text-center" colSpan={2} headers={["Player Stats"]}>
			<>
				{(Object.keys(gameConfig.classes) as Classes[V3Game][])
					.sort(StrSOV((x) => x[0]))
					.filter((k) => ugs.classes[k] !== undefined && ugs.classes[k] !== null)
					.map((k) => (
						<tr key={k}>
							<td>{UppercaseFirst(k)}</td>
							<td>
								<ClassBadge
									classSet={k}
									classValue={ugs.classes[k]!}
									game={game}
									key={`${k}:${ugs.classes[k]}`}
									showSetOnHover={false}
								/>
							</td>
						</tr>
					))}
				{ratings.map(([k, v]) => (
					<tr key={k}>
						<td>
							<QuickTooltip
								tooltipContent={
									<div style={{ whiteSpace: "pre-line" }}>
										{gameConfig.profileRatingAlgs[k].description}
										{(gameConfig.profileRatingAlgs[k].associatedScoreAlgs ?? [])
											.length > 0 && (
											<>
												<Divider />
											</>
										)}
										{gameConfig.profileRatingAlgs[k].associatedScoreAlgs?.map(
											(alg) => (
												<div key={alg}>
													({FormatGPTScoreRatingName(game, alg)}:{" "}
													{gameConfig.scoreRatingAlgs[alg].description})
												</div>
											),
										)}
									</div>
								}
								wide
							>
								<div
									style={{
										textDecoration: "underline",
										textDecorationStyle: "dotted",
									}}
								>
									{FormatGPTProfileRatingName(game, k)}
								</div>
							</QuickTooltip>
						</td>
						<td style={getProfileRatingAlgRowStyle(game, k)}>
							{FormatGPTProfileRating(game, k as any, v)}
						</td>
					</tr>
				))}
			</>
		</MiniTable>
	);
}
