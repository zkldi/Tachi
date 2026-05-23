import type { FolderStatsInfo } from "#types/api-returns";

import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Muted from "#components/util/Muted";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatGPTEnumMetric, ToFixedFloor } from "#util/misc";
import React, { useLayoutEffect, useRef, useState } from "react";
import { type GameConfig, GetScoreMetricConf, V3Game } from "tachi-common";

import barStyles from "./FolderEnumProgressBar.module.scss";

const FOLDER_ENUM_BAR_HEIGHT = "1.75rem";

/** In-bar `%` text only when the segment is at least this wide (measured in CSS pixels). */
const MIN_SEGMENT_WIDTH_PX_FOR_INLINE_LABEL = 30;

export default function FolderEnumProgressBar({
	game,
	animateSegments = true,
	clipToMinimumRelevance = false,
	stats,
	enumMetric,
	gameConfig,
	colours,
}: {
	animateSegments?: boolean;
	/** When true, only segments at or stronger than `minimumRelevantValue` contribute (matches evolution semantics). */
	clipToMinimumRelevance?: boolean;
	colours: Record<string, string> | undefined;
	enumMetric: string;
	game: V3Game;
	gameConfig: GameConfig;
	stats: FolderStatsInfo;
}) {
	const barRef = useRef<HTMLDivElement>(null);
	const [barWidthPx, setBarWidthPx] = useState(0);

	useLayoutEffect(() => {
		const el = barRef.current;
		if (!el) {
			return;
		}

		const update = () => {
			setBarWidthPx(el.getBoundingClientRect().width);
		};

		update();
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w !== undefined) {
				setBarWidthPx(w);
			}
		});
		ro.observe(el);
		return () => {
			ro.disconnect();
		};
	}, []);

	const conf = GetScoreMetricConf(gameConfig, enumMetric);
	if (conf.type !== "ENUM") {
		return null;
	}

	const total = stats.chartCount;
	const bucket = stats.stats[enumMetric] ?? {};

	const minRelIx = conf.values.indexOf(conf.minimumRelevantValue);
	const valueIndexFloor = clipToMinimumRelevance && minRelIx !== -1 ? minRelIx : 0;

	const segments: Array<{ count: number; label: string; rawFill: string }> = [];
	let filled = 0;
	for (let vi = conf.values.length - 1; vi >= valueIndexFloor; vi--) {
		const v = conf.values[vi];
		const count = bucket[v] ?? 0;
		if (count > 0) {
			filled += count;
			segments.push({
				label: FormatGPTEnumMetric(game, enumMetric, v),
				count,
				rawFill: colours?.[v] ?? "var(--bs-secondary-bg)",
			});
		}
	}

	if (total === 0) {
		return <Muted>—</Muted>;
	}

	const remainder = Math.max(0, total - filled);
	const remainderWidthPct = total > 0 ? (100 * remainder) / total : 0;

	return (
		<div
			className={`border overflow-hidden rounded-3 ${barStyles.folderEnumBar} ${animateSegments ? barStyles.folderEnumBarAnimated : ""}`}
			dir="ltr"
			lang="en"
			ref={barRef}
			style={{
				backgroundColor: "var(--bs-secondary-bg)",
				direction: "ltr",
				display: "block",
				height: FOLDER_ENUM_BAR_HEIGHT,
				minHeight: "1.5rem",
				unicodeBidi: "isolate",
				width: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					height: "100%",
					width: "100%",
				}}
			>
				{segments.map((seg, segIndex) => {
					const pct = total > 0 ? (100 * seg.count) / total : 0;
					const fill = seg.rawFill.startsWith("var(")
						? seg.rawFill
						: ChangeOpacity(seg.rawFill, 0.92);
					const segmentWidthPx = barWidthPx > 0 ? (pct / 100) * barWidthPx : 0;
					const showInlinePct = segmentWidthPx >= MIN_SEGMENT_WIDTH_PX_FOR_INLINE_LABEL;
					const inlinePctText = `${Math.round(pct)}%`;

					return (
						<QuickTooltip
							key={seg.label}
							tooltipContent={
								<>
									<div>{seg.label}</div>
									<div>{ToFixedFloor(pct, 2)}%</div>
									<Muted>
										({seg.count} / {total})
									</Muted>
								</>
							}
						>
							<div
								className={`h-100 ${barStyles.folderEnumBarSegment} ${animateSegments ? barStyles.folderEnumBarSegmentAnimated : ""}`}
								style={{
									...(animateSegments
										? { animationDelay: `${0.05 + segIndex * 0.055}s` }
										: {}),
									backgroundColor: fill,
									flex: "none",
									minWidth: seg.count ? "4px" : 0,
									width: `${pct}%`,
								}}
							>
								{showInlinePct && (
									<span className={barStyles.folderEnumBarLabel}>
										{inlinePctText}
									</span>
								)}
							</div>
						</QuickTooltip>
					);
				})}
				{remainderWidthPct > 0 && (
					<div
						aria-hidden
						className={`h-100 ${barStyles.folderEnumBarRemainder} ${animateSegments ? barStyles.folderEnumBarRemainderAnimated : ""}`}
						style={{
							...(animateSegments
								? {
										animationDelay: `${0.05 + segments.length * 0.055}s`,
									}
								: {}),
							backgroundColor: "transparent",
							flex: "none",
							width: `${remainderWidthPct}%`,
						}}
					/>
				)}
			</div>
		</div>
	);
}
