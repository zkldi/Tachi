import type { FolderStatsInfo } from "#types/api-returns";

import { WindowContext } from "#context/WindowContext";
import { ChangeOpacity } from "#util/color-opacity";
import { FormatGPTEnumMetric, ToFixedFloor, UppercaseFirst } from "#util/misc";
import React, { useContext } from "react";
import { type GameConfig, GetScoreMetricConf, V3Game } from "tachi-common";

import breakdownStyles from "./FolderEnumDistributionBreakdown.module.scss";

/** Row wash (track) uses a faint tint of the ladder colour; the fill bar uses a stronger tint of that same ladder colour — no neutral body BG. */
function distributionRowChrome(enumColour: string | undefined): {
	borderLeftColor: string;
	fillStrong: string | undefined;
	trackBg: string;
} {
	const fallbackTrack = "color-mix(in srgb, var(--bs-secondary) 14%, transparent)";
	const fallbackFillStrong = "color-mix(in srgb, var(--bs-secondary) 42%, transparent)";

	const borderLeftColor = enumColour ?? "var(--bs-secondary)";

	if (enumColour && (enumColour.startsWith("#") || enumColour.startsWith("rgb"))) {
		try {
			return {
				borderLeftColor: enumColour,
				fillStrong: ChangeOpacity(enumColour, 0.5),
				trackBg: ChangeOpacity(enumColour, 0.14),
			};
		} catch {
			/* fall through */
		}
	}

	if (enumColour) {
		return {
			borderLeftColor: enumColour,
			fillStrong: `color-mix(in srgb, ${enumColour} 48%, transparent)`,
			trackBg: `color-mix(in srgb, ${enumColour} 14%, transparent)`,
		};
	}

	return {
		borderLeftColor,
		fillStrong: fallbackFillStrong,
		trackBg: fallbackTrack,
	};
}

/**
 * Styled enum value × count breakdown (counts + % of folder charts).
 * Rows use GPT enum colours; optional floor at `minimumRelevantValue`; remainder row for unmatched charts.
 */
export default function FolderEnumDistributionBreakdown({
	game,
	clipToMinimumRelevance = false,
	colours,
	enumMetric,
	gameConfig,
	onActivate,
	onEnumBreakdownRowClick,
	remainderLabel,
	selected,
	stats,
	suppressTopRule = false,
}: {
	clipToMinimumRelevance?: boolean;
	colours: Record<string, string> | undefined;
	enumMetric: string;
	game: V3Game;
	gameConfig: GameConfig;
	onActivate?: () => void;
	/** Desktop `(isLg)`: activates folder chart filter + scroll; ignored on narrow viewports. */
	onEnumBreakdownRowClick?: (enumValueLabel: string) => void;
	remainderLabel?: string;
	/** Highlights this block when picking the active evolution replay metric from Overview. */
	selected?: boolean;
	/** Folder-level stats blob from `GET .../folders/:slug/stats`, or replay slice with same shape. */
	stats: FolderStatsInfo;
	/** When stacking inside one card, skip the inset top rule on the first section. */
	suppressTopRule?: boolean;
}) {
	const remainderLine = remainderLabel ?? "Not played";

	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);

	const conf = GetScoreMetricConf(gameConfig, enumMetric);
	if (conf.type !== "ENUM") {
		return null;
	}

	const total = stats.chartCount;
	const bucket = stats.stats[enumMetric] ?? {};

	const minRelIx = conf.values.indexOf(conf.minimumRelevantValue);
	const valueIndexFloor = clipToMinimumRelevance && minRelIx !== -1 ? minRelIx : 0;

	if (total === 0) {
		return <small className="text-body-secondary">No charts in this folder.</small>;
	}

	let filled = 0;
	let cumulativeCount = 0;
	const rows = [];

	for (let vi = conf.values.length - 1; vi >= valueIndexFloor; vi--) {
		const label = conf.values[vi];
		const printedLabel = FormatGPTEnumMetric(game, enumMetric, label);
		const count = bucket[label] ?? 0;

		filled += count;
		cumulativeCount += count;

		const pct = total > 0 ? (100 * count) / total : 0;
		const cumulPct = total > 0 ? (100 * cumulativeCount) / total : 0;
		const showCumul = cumulativeCount > count && (minRelIx === -1 || vi >= minRelIx);
		const chipFill = colours?.[label];
		const chrome = distributionRowChrome(chipFill);
		const pctWidth = pct > 0 ? `${ToFixedFloor(Math.min(100, Math.max(0, pct)), 3)}%` : "0%";

		const clickableRow = Boolean(onEnumBreakdownRowClick && isLg && count > 0);
		const rowHoverChromeClass = clickableRow ? breakdownStyles.enumRowInteractive : "";

		const rowShellStyle = {
			backgroundColor: chrome.trackBg,
			border: "1px solid var(--bs-border-color-translucent)",
			borderLeftColor: chrome.borderLeftColor,
			borderLeftStyle: "solid" as const,
			borderLeftWidth: 4,
			borderRadius: "var(--bs-border-radius-lg)",
			opacity: count === 0 ? 0.62 : undefined,
		};

		const rowInterior = (
			<>
				{chrome.fillStrong && pct > 0 ? (
					<div
						aria-hidden
						className="position-absolute start-0 top-0 bottom-0"
						style={{
							backgroundColor: chrome.fillStrong,
							transition: "width 0.35s ease-out",
							width: pctWidth,
						}}
					/>
				) : null}
				<div className="align-items-center position-relative z-1 d-flex flex-wrap gap-2 justify-content-between px-3 py-2">
					<span className="fw-semibold lh-sm mb-0 pe-2 text-body" title={label}>
						<span
							aria-hidden
							className="d-inline-block me-2 rounded-circle"
							style={{
								backgroundColor: chipFill ?? "var(--bs-secondary)",
								flexShrink: 0,
								height: "0.5rem",
								verticalAlign: "middle",
								width: "0.5rem",
							}}
						/>
						{printedLabel}
					</span>
					<span className="ms-auto tabular-nums text-nowrap">
						<span
							className="me-3 small text-body-secondary opacity-75"
							style={showCumul ? undefined : { visibility: "hidden" }}
						>
							total {cumulativeCount} ({ToFixedFloor(cumulPct, 1)}%)
						</span>
						<span className="fw-bold fs-6 text-body-emphasis">{count}</span>
						<span className="ms-2 small text-body-secondary">
							({ToFixedFloor(pct, 1)}%)
						</span>
					</span>
				</div>
			</>
		);

		rows.push(
			clickableRow && onEnumBreakdownRowClick ? (
				<button
					aria-label={`Show charts filtered to ${enumMetric}: ${label}`}
					className={`position-relative overflow-hidden shadow-sm text-start border-0 p-0 w-100 text-body ${rowHoverChromeClass}`}
					key={label}
					onClick={() => {
						onEnumBreakdownRowClick(label);
					}}
					style={rowShellStyle}
					type="button"
				>
					{rowInterior}
				</button>
			) : (
				<div
					className={`position-relative overflow-hidden shadow-sm ${rowHoverChromeClass}`}
					key={label}
					style={rowShellStyle}
				>
					{rowInterior}
				</div>
			),
		);
	}

	const remainder = Math.max(0, total - filled);
	const remainderPct = total > 0 ? (100 * remainder) / total : 0;

	return (
		<div
			className={
				selected
					? "border border-primary border-opacity-75 pb-3 pe-2 pt-2 ps-2 rounded-4 shadow-sm bg-primary bg-opacity-10"
					: undefined
			}
		>
			<div
				className={
					suppressTopRule
						? undefined
						: "mt-3 border-secondary border-opacity-25 border-top pt-3"
				}
			>
				<div className="align-items-center d-flex flex-wrap gap-2 justify-content-between mb-2">
					{onActivate ? (
						<button
							className={`btn btn-sm fw-semibold text-uppercase ${selected ? "btn-primary" : "btn-outline-secondary"}`}
							onClick={onActivate}
							style={{ letterSpacing: "0.06em" }}
							type="button"
						>
							{UppercaseFirst(enumMetric)}
							{selected ? (
								<span className="fst-normal ms-2 fw-normal text-white-50 text-capitalize">
									(for replay)
								</span>
							) : null}
						</button>
					) : (
						<div
							className="fw-semibold lh-sm small text-body-secondary text-uppercase"
							style={{ letterSpacing: "0.06em" }}
						>
							{UppercaseFirst(enumMetric)} breakdown
						</div>
					)}
				</div>
				<div className="d-flex flex-column gap-2">{rows}</div>
				{remainder > 0 ? (
					<div
						className="position-relative overflow-hidden mt-2"
						style={{
							backgroundColor:
								"color-mix(in srgb, var(--bs-secondary) 14%, transparent)",
							border: "1px dashed var(--bs-border-color-translucent)",
							borderRadius: "var(--bs-border-radius-lg)",
						}}
					>
						<div
							aria-hidden
							className="position-absolute start-0 top-0 bottom-0"
							style={{
								backgroundColor:
									"color-mix(in srgb, var(--bs-secondary) 40%, transparent)",
								transition: "width 0.35s ease-out",
								width: `${ToFixedFloor(Math.min(100, Math.max(0, remainderPct)), 3)}%`,
							}}
						/>
						<div className="position-relative z-1 align-items-center d-flex flex-wrap gap-2 justify-content-between px-3 py-2 small text-body-secondary">
							<span className="fst-italic fw-semibold">{remainderLine}</span>
							<span className="ms-auto tabular-nums text-nowrap">
								<span className="fw-bold text-body-emphasis">{remainder}</span>
								<span className="ms-2 small text-body-secondary">
									({ToFixedFloor(remainderPct, 1)}%)
								</span>
							</span>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
