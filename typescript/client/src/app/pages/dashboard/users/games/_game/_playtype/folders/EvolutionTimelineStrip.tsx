import type { TableEvolutionEventAPI } from "#types/api-returns";

import { FormatDate } from "#util/time";
import React, { useCallback, useMemo, useRef } from "react";
import { type GameConfig, GetScoreMetricConf } from "tachi-common";

import timelineStyles from "./EvolutionTimelineStrip.module.scss";
import { evoEventTimeMs } from "./folderTableShared";

/** Horizontal resolution of the density graph (few DOM nodes vs one per milestone). */
const TIMELINE_BIN_COUNT = 200;

const VIEW_BOX_H = 120;
const PLOT_TOP = 8;
const PLOT_BOTTOM = VIEW_BOX_H - 10;

const GRAPH_CSS_HEIGHT_PX = VIEW_BOX_H;

export default function EvolutionTimelineStrip({
	allEnumColours,
	axisSpan,
	enumMetric,
	gameConfig,
	maxAxis,
	minAxis,
	rangeId,
	rangeStep,
	scrubTimeMs,
	setPlaying,
	setScrubTimeMs,
	workingEvents,
}: {
	allEnumColours: Record<string, Record<string, string>> | undefined;
	axisSpan: number;
	enumMetric: string;
	gameConfig: GameConfig;
	maxAxis: number;
	minAxis: number;
	rangeId: string;
	rangeStep: number;
	scrubTimeMs: number;
	setPlaying: (v: boolean) => void;
	setScrubTimeMs: (v: number) => void;
	workingEvents: TableEvolutionEventAPI[];
}) {
	const trackRef = useRef<HTMLDivElement>(null);

	const scrubClampedMs = Math.min(Math.max(scrubTimeMs, minAxis), maxAxis);
	const playheadLeftPct =
		axisSpan <= 0
			? 0
			: Math.min(100, Math.max(0, (100 * (scrubClampedMs - minAxis)) / axisSpan));

	const scrubFromClientX = useCallback(
		(clientX: number) => {
			const el = trackRef.current;
			if (!el || workingEvents.length === 0 || axisSpan <= 0) {
				return;
			}

			const { left, width } = el.getBoundingClientRect();
			if (width <= 0) {
				return;
			}

			const ratio = Math.min(1, Math.max(0, (clientX - left) / width));
			const nextMs = minAxis + ratio * axisSpan;
			setScrubTimeMs(Math.min(maxAxis, Math.max(minAxis, nextMs)));
		},
		[axisSpan, maxAxis, minAxis, setScrubTimeMs, workingEvents.length],
	);

	const onPointerDownTrack = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (workingEvents.length === 0) {
				return;
			}

			e.currentTarget.setPointerCapture(e.pointerId);
			setPlaying(false);
			scrubFromClientX(e.clientX);
		},
		[scrubFromClientX, setPlaying, workingEvents.length],
	);

	const onPointerMoveTrack = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (workingEvents.length === 0) {
				return;
			}

			if (!(e.pressure > 0 || e.buttons & 1)) {
				return;
			}

			scrubFromClientX(e.clientX);
		},
		[scrubFromClientX, workingEvents.length],
	);

	const releasePointerCaptureIfAny = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		try {
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		} catch {
			// ignore races with unmount/cancelled pointers
		}
	}, []);

	const onSliderKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (workingEvents.length === 0) {
				return;
			}

			const stepMs = Number.isFinite(rangeStep) ? rangeStep : 1000;

			let nextMs = scrubClampedMs;

			switch (e.key) {
				case "ArrowLeft":
				case "ArrowDown":
					nextMs -= stepMs;
					e.preventDefault();
					break;

				case "ArrowRight":
				case "ArrowUp":
					nextMs += stepMs;
					e.preventDefault();
					break;

				case "Home":
					nextMs = minAxis;
					e.preventDefault();
					break;

				case "End":
					nextMs = maxAxis;
					e.preventDefault();
					break;

				case "PageDown":
					nextMs += axisSpan * 0.1;
					e.preventDefault();
					break;

				case "PageUp":
					nextMs -= axisSpan * 0.1;
					e.preventDefault();
					break;

				default:
					return;
			}

			setPlaying(false);
			setScrubTimeMs(Math.min(maxAxis, Math.max(minAxis, nextMs)));
		},
		[
			axisSpan,
			maxAxis,
			minAxis,
			rangeStep,
			scrubClampedMs,
			setPlaying,
			setScrubTimeMs,
			workingEvents.length,
		],
	);

	const graphBody = useMemo(() => {
		const conf = GetScoreMetricConf(gameConfig, enumMetric);
		const metricEnumLen = conf.type === "ENUM" ? conf.values.length : 1;
		const enumLen = Math.max(metricEnumLen, 1);

		const bins: number[][] = Array.from({ length: TIMELINE_BIN_COUNT }, () =>
			new Array(enumLen).fill(0),
		);

		if (workingEvents.length === 0) {
			return null;
		}

		const span = Math.max(axisSpan, Number.EPSILON);
		for (const evNotch of workingEvents) {
			const tNotch = evoEventTimeMs(evNotch);
			const rel = (tNotch - minAxis) / span;
			if (!(rel >= 0 && rel <= 1)) {
				continue;
			}
			let bucket = Math.floor(rel * TIMELINE_BIN_COUNT);
			if (bucket >= TIMELINE_BIN_COUNT) {
				bucket = TIMELINE_BIN_COUNT - 1;
			}
			if (bucket < 0) {
				bucket = 0;
			}

			let enumIdx = 0;
			if (conf.type === "ENUM" && metricEnumLen > 0) {
				enumIdx = Math.min(Math.max(evNotch.enumIndex, 0), metricEnumLen - 1);
			}
			bins[bucket][enumIdx] += 1;
		}

		let maxBucketTotal = 0;
		for (const row of bins) {
			let sum = 0;
			for (const c of row) {
				sum += c;
			}
			if (sum > maxBucketTotal) {
				maxBucketTotal = sum;
			}
		}
		const norm = maxBucketTotal > 0 ? maxBucketTotal : 1;

		const plots: React.ReactElement[] = [];
		const bucketW = TIMELINE_BIN_COUNT;
		const inset = 0.1;
		const barW = 1 - 2 * inset;

		for (let bi = 0; bi < TIMELINE_BIN_COUNT; bi++) {
			const row = bins[bi];
			let bucketTotal = 0;
			for (const c of row) {
				bucketTotal += c;
			}
			if (bucketTotal === 0) {
				continue;
			}

			const bucketH = (bucketTotal / norm) * (PLOT_BOTTOM - PLOT_TOP);
			let yBottom = PLOT_BOTTOM;

			for (let ej = row.length - 1; ej >= 0; ej--) {
				const count = row[ej];
				if (count === 0 || bucketTotal === 0) {
					continue;
				}
				const segH = (count / bucketTotal) * bucketH;
				const yTop = yBottom - segH;
				const valueLabel =
					conf.type === "ENUM" && metricEnumLen > 0 ? (conf.values[ej] ?? "") : "";
				const colour =
					valueLabel !== ""
						? (allEnumColours?.[enumMetric]?.[valueLabel] ?? "var(--bs-secondary)")
						: "var(--bs-secondary)";

				plots.push(
					<rect
						fill={colour}
						height={Math.max(segH, 0.15)}
						key={`b-${bi}-e-${ej}`}
						opacity={0.9}
						width={barW}
						x={bi + inset}
						y={yTop}
					/>,
				);
				yBottom = yTop;
			}
		}

		return (
			<g aria-hidden>
				<rect
					fill="var(--bs-secondary-bg)"
					height={PLOT_BOTTOM - PLOT_TOP}
					opacity={0.65}
					rx={1}
					stroke="var(--bs-border-color)"
					strokeOpacity={0.4}
					strokeWidth={0.12}
					width={bucketW}
					x={0}
					y={PLOT_TOP}
				/>
				{plots}
			</g>
		);
	}, [allEnumColours, axisSpan, enumMetric, gameConfig, minAxis, workingEvents]);

	const interactive = workingEvents.length > 0;

	return (
		<>
			<p className="small lh-sm mx-auto mb-3 text-body-secondary text-center px-2">
				<strong>Drag or click</strong> the chart to move in time - use arrow keys when the
				chart has focus for keyboard scrubbing.
			</p>

			<div
				aria-disabled={!interactive}
				aria-labelledby={rangeId}
				aria-valuemax={maxAxis}
				aria-valuemin={minAxis}
				aria-valuenow={Math.round(scrubClampedMs)}
				aria-valuetext={`Replay time ${FormatDate(scrubClampedMs)}`}
				className={`${timelineStyles.track} position-relative rounded-4 overflow-hidden shadow-sm border border-primary border-opacity-25 bg-body-secondary bg-opacity-10 w-100 ${
					interactive ? "user-select-none" : "opacity-75 pe-none"
				}`}
				onKeyDown={onSliderKeyDown}
				onPointerCancel={releasePointerCaptureIfAny}
				onPointerDown={onPointerDownTrack}
				onPointerMove={onPointerMoveTrack}
				onPointerUp={releasePointerCaptureIfAny}
				ref={trackRef}
				role={interactive ? "slider" : undefined}
				style={{
					cursor: interactive ? "grab" : "not-allowed",
					height: GRAPH_CSS_HEIGHT_PX,
					touchAction: interactive ? "none" : undefined,
				}}
				tabIndex={interactive ? 0 : -1}
			>
				<svg
					aria-hidden
					className="d-block h-100 w-100 bg-transparent"
					height="100%"
					preserveAspectRatio="none"
					viewBox={`0 0 ${TIMELINE_BIN_COUNT} ${VIEW_BOX_H}`}
					width="100%"
				>
					<title>Milestone density (decorative).</title>
					{graphBody}
				</svg>

				{interactive ? (
					<div
						aria-hidden
						className="bg-body-emphasis opacity-85 position-absolute rounded-pill shadow"
						style={{
							bottom: "6%",
							left: `${playheadLeftPct}%`,
							pointerEvents: "none",
							top: "8%",
							transform: "translateX(-50%)",
							width: "4px",
							zIndex: 2,
						}}
					/>
				) : null}
			</div>
		</>
	);
}
