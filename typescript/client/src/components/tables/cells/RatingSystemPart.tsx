import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameRatingSystem } from "#lib/types";
import { IsNotNullish } from "#util/misc";
import React from "react";
import { type ChartDocument, type V3Game } from "tachi-common";

import MiniTable from "../components/MiniTable";

export default function RatingSystemPart({
	chart,
	game,
	truncateRatingsLines,
}: {
	chart: ChartDocument;
	game: V3Game;
	truncateRatingsLines?: boolean;
}) {
	const ratingSystems: Array<GameRatingSystem<any>> =
		GAME_CLIENT_IMPLEMENTATIONS[game].ratingSystems;

	if (ratingSystems.filter((e) => typeof e.toNumber(chart) === "number").length === 0) {
		return null;
	}

	const joinedRatingsDisplay = ratingSystems
		.map((r) => r.toString(chart as any))
		.filter((e) => IsNotNullish(e))
		.join(" / ");

	const miniTableRatingsContent = (
		<MiniTable colSpan={2} headers={["Ratings"]}>
			{ratingSystems.map((e) => {
				const strV = e.toString(chart);
				const numV = e.toNumber(chart);

				if (strV === null || strV === undefined || numV === null || numV === undefined) {
					return null;
				}

				return (
					<tr key={e.name}>
						<td>{e.name}</td>
						<td>
							{strV} <Muted>({numV.toFixed(2)})</Muted>
							{e.idvDifference(chart) && (
								<>
									<br />
									<QuickTooltip tooltipContent="Individual Difference - The difficulty of this varies massively between people!">
										<span>
											<Icon type="balance-scale-left" />
										</span>
									</QuickTooltip>
								</>
							)}
						</td>
					</tr>
				);
			})}
		</MiniTable>
	);

	const desktopMutedBlock = truncateRatingsLines ? (
		<div className="d-block text-truncate" style={{ minWidth: 0 }}>
			<Muted>{joinedRatingsDisplay}</Muted>
		</div>
	) : (
		<div>
			<Muted>{joinedRatingsDisplay}</Muted>
		</div>
	);

	return (
		<>
			<div className="d-none d-lg-block">
				<QuickTooltip tooltipContent={miniTableRatingsContent}>
					{desktopMutedBlock}
				</QuickTooltip>
			</div>
			<div className="d-block d-lg-none">
				{truncateRatingsLines ? (
					<div className="d-block text-truncate" style={{ minWidth: 0 }}>
						<Muted>{joinedRatingsDisplay}</Muted>
					</div>
				) : (
					<Muted>
						{ratingSystems.map((r) => (
							<React.Fragment key={r.name}>
								{r.toString(chart as any)}
								<br />
							</React.Fragment>
						))}
					</Muted>
				)}
			</div>
		</>
	);
}
