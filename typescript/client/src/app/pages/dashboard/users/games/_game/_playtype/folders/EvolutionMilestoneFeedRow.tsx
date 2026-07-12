import type { TableEvolutionEventAPI } from "#types/api-returns";

import Muted from "#components/util/Muted";
import { CreateChartLink } from "#util/data";
import { UppercaseFirst } from "#util/misc";
import { FormatTime, MillisToSince } from "#util/time";
import React, { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
	type ChartDocument,
	FormatDifficultyShort,
	type SongDocument,
	type V3Game,
} from "tachi-common";

import rowStyles from "./EvolutionMilestoneFeedRow.module.scss";

type EvolutionFeedEvent = TableEvolutionEventAPI;

const feedRowBaseClass =
	"border border-secondary border-opacity-25 flex-shrink-0 position-relative rounded-3 shadow-sm";

export default function EvolutionMilestoneFeedRow({
	evRow,
	chart,
	game,
	song,
	articleStyle,
	chipFill,
	chipBg,
}: {
	articleStyle: CSSProperties;
	chart?: ChartDocument;
	chipBg: string | undefined;
	chipFill: string | undefined;
	evRow: EvolutionFeedEvent;
	game: V3Game;
	song?: SongDocument;
}) {
	const timeMs = evRow.timeAchieved ?? evRow.timeAdded;
	const chartHref = chart ? CreateChartLink(chart) : `/games/${game}/charts/${evRow.chartID}`;

	const body = (
		<div className="p-3">
			<div className="row g-3 align-items-start">
				<div className="col-12 col-lg-8 order-2 order-lg-1 min-w-0">
					<div className="fs-6 lh-sm mb-2">
						{song && chart ? (
							<>
								<span className="fw-semibold text-body-emphasis">{song.title}</span>
								<span className="text-body-secondary fw-normal ms-2 small text-nowrap">
									({FormatDifficultyShort(chart)})
								</span>
							</>
						) : chart ? (
							<>
								<span className="fst-italic text-body-secondary">
									Unknown chart
								</span>
								<span className="text-body-secondary fw-normal ms-2 small text-nowrap">
									({FormatDifficultyShort(chart)})
								</span>
							</>
						) : (
							<span className="fst-italic text-body-secondary">Unknown chart</span>
						)}
					</div>
					<div className="d-flex align-items-center flex-wrap gap-2 border-secondary border-opacity-25 border-top pt-2">
						<small className="text-body-secondary lh-1 mb-0 text-uppercase">
							{UppercaseFirst(evRow.metric)}
						</small>
						<span
							className="fw-semibold lh-sm px-2 py-1 rounded-pill border small shadow-sm"
							style={{
								borderColor: chipFill ?? "var(--bs-secondary)",
								backgroundColor: chipBg ?? "var(--bs-body-bg)",
							}}
						>
							{evRow.value}
						</span>
					</div>
				</div>
				<div className="col-12 col-lg-4 order-1 order-lg-2">
					<div
						className="bg-body-tertiary bg-opacity-50 border border-secondary border-opacity-25 lh-sm ms-lg-auto px-3 py-2 rounded-3 tabular-nums text-lg-end w-100"
						style={{
							maxWidth: "22rem",
						}}
					>
						<div className="fs-6 fw-semibold mb-1 text-body-emphasis lh-sm">
							{MillisToSince(timeMs)}
						</div>

						<div className="mt-1">
							<Muted>{FormatTime(timeMs)}</Muted>
						</div>
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<Link
			className={`${rowStyles.feedRowLink} ${feedRowBaseClass}`}
			style={articleStyle}
			to={chartHref}
		>
			{body}
		</Link>
	);
}
