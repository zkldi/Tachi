import type { FolderStatsInfo, UGPTEvolutionReplayReturns } from "#types/api-returns";

import ApiError from "#components/util/ApiError";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import { useBucket } from "#components/util/useBucket";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartIDMap, CreateSongMap } from "#util/data";
import { UppercaseFirst } from "#util/misc";
import { FormatDate, MillisToSince } from "#util/time";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Collapse from "react-bootstrap/Collapse";
import Dropdown from "react-bootstrap/Dropdown";
import {
	type FolderDocument,
	type GameConfig,
	GetScoreMetrics,
	type TableDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import EvolutionMilestoneFeedRow from "./EvolutionMilestoneFeedRow";
import EvolutionTimelineStrip from "./EvolutionTimelineStrip";
import FolderEnumDistributionBreakdown from "./FolderEnumDistributionBreakdown";
import FolderEnumProgressBar from "./FolderEnumProgressBar";
import folderTableStyles from "./FolderTablePage.module.scss";
import {
	buildEvolutionReplayFolderStats,
	evoEventTimeMs,
	tableFolderSlugsDisplayOrder,
} from "./folderTableShared";

export type EvolutionReplayScope =
	| { folder: FolderDocument; kind: "folder" }
	| { kind: "table"; table: TableDocument };

const MILESTONE_FEED_MAX_ROWS = 20;

/** Wall-clock multipliers vs the baseline tween (long spans aim for ~≤28s at 1×). */
const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

export default function TableEvolutionReplay({
	controlledEnumMetric,
	game,
	gameConfig,
	reqUser,
	scope,
}: {
	controlledEnumMetric?: readonly [
		metric: string,
		setMetric: React.Dispatch<React.SetStateAction<string>>,
	];
	game: V3Game;
	gameConfig: GameConfig;
	reqUser: UserDocument;
	scope: EvolutionReplayScope;
}) {
	const externallyControlled = controlledEnumMetric !== undefined;
	const replayScopeKey = scope.kind === "folder" ? scope.folder.folderID : scope.table.tableID;

	const bucket = useBucket(game);
	const [internalEnumMetric, setInternalEnumMetric] = useState(bucket);

	useEffect(() => {
		if (externallyControlled) {
			return;
		}

		setInternalEnumMetric(bucket);
	}, [bucket, externallyControlled, game, replayScopeKey]);

	const enumMetric = externallyControlled ? controlledEnumMetric[0] : internalEnumMetric;
	const setEnumMetric = externallyControlled ? controlledEnumMetric[1] : setInternalEnumMetric;

	const enumMetricChoices = useMemo(() => GetScoreMetrics(gameConfig, "ENUM"), [gameConfig]);

	const [open, setOpen] = useState(false);
	const [scrubTimeMs, setScrubTimeMs] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState<(typeof PLAYBACK_SPEED_OPTIONS)[number]>(1);

	/** Wall clock anchor for timeline max (right edge = "now"); ticks while replay is expanded. */
	const [replayNowMs, setReplayNowMs] = useState(() => Date.now());
	/** Bumps whenever the replay panel expands so we snap scrub to today's edge without reacting to replayNowMs ticking. */
	const [replayOpenNonce, setReplayOpenNonce] = useState(0);

	useLayoutEffect(() => {
		if (!open) {
			return;
		}

		setReplayNowMs(Date.now());
		setReplayOpenNonce((n) => n + 1);
	}, [open]);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		const id = window.setInterval(() => {
			setReplayNowMs(Date.now());
		}, 60_000);

		return () => {
			window.clearInterval(id);
		};
	}, [open]);

	const evolutionUrl =
		scope.kind === "table"
			? `/users/${reqUser.id}/games/${game}/tables/${scope.table.tableID}/evolution`
			: `/users/${reqUser.id}/games/${game}/folders/${scope.folder.slug}/evolution`;

	const replayDomId = scope.kind === "table" ? scope.table.tableID : scope.folder.folderID;

	const folderSlugOrder = useMemo(
		() =>
			scope.kind === "table"
				? tableFolderSlugsDisplayOrder(scope.table, game)
				: [scope.folder.slug],
		[scope, game],
	);

	const scrubRef = useRef(0);
	const foldersReplayPanelRef = useRef<HTMLDivElement>(null);
	const [milestoneFeedFrameHeightPx, setMilestoneFeedFrameHeightPx] = useState(0);
	const [evoTitleWidth, setEvoTitleWidth] = useState<number | null>(null);

	useLayoutEffect(() => {
		scrubRef.current = scrubTimeMs;
	}, [scrubTimeMs]);

	const {
		data: evo,
		error: evoError,
		isLoading: evolutionLoading,
	} = useApiQuery<UGPTEvolutionReplayReturns>(evolutionUrl, undefined, undefined, !open);

	const events = useMemo(() => evo?.events ?? [], [evo?.events]);

	const workingEvents = useMemo(
		() => events.filter((evItem) => evItem.metric === enumMetric),
		[events, enumMetric],
	);

	/** Chronologically first milestone in the evolution payload (any enum metric ≈ earliest table scores we model). */
	const tableEvolutionEarliestMs = useMemo(() => {
		let earliest: number | undefined;

		for (const evItem of events) {
			const t = evoEventTimeMs(evItem);
			if (!Number.isFinite(t)) {
				continue;
			}
			earliest = earliest === undefined ? t : Math.min(earliest, t);
		}

		return earliest;
	}, [events]);

	const { minAxis, maxAxis } = useMemo(() => {
		const nowMs = replayNowMs;

		if (workingEvents.length === 0) {
			return { minAxis: 0, maxAxis: 1 };
		}

		const times = workingEvents.map(evoEventTimeMs);
		const firstT = Math.min(...times);
		const lastT = Math.max(...times);

		if (!(Number.isFinite(firstT) && Number.isFinite(lastT))) {
			const anchorMs =
				tableEvolutionEarliestMs !== undefined
					? tableEvolutionEarliestMs
					: nowMs - 3_600_000;
			return {
				minAxis: anchorMs,
				maxAxis: nowMs,
			};
		}

		const axisLeftMs =
			tableEvolutionEarliestMs !== undefined ? tableEvolutionEarliestMs : firstT;

		return {
			// Timeline starts at the earliest milestone in evolution for this table (any metric).
			minAxis: axisLeftMs,

			maxAxis: Math.max(nowMs, lastT),
		};
	}, [replayNowMs, tableEvolutionEarliestMs, workingEvents]);

	const axisSpan = Math.max(maxAxis - minAxis, 1);

	const minAxisRef = useRef(minAxis);
	minAxisRef.current = minAxis;
	const maxAxisRef = useRef(maxAxis);
	maxAxisRef.current = maxAxis;
	const axisSpanRef = useRef(axisSpan);
	axisSpanRef.current = axisSpan;

	const appliedEvents = useMemo(() => {
		if (workingEvents.length === 0) {
			return [];
		}

		return workingEvents.filter((e) => evoEventTimeMs(e) <= scrubTimeMs);
	}, [scrubTimeMs, workingEvents]);

	useEffect(() => {
		if (!open || !evo) {
			setPlaying(false);
			return;
		}

		if (workingEvents.length === 0) {
			return;
		}

		setScrubTimeMs(maxAxisRef.current);
		setPlaying(false);
	}, [evo, enumMetric, open, replayOpenNonce, workingEvents.length]);

	useEffect(() => {
		if (!playing || workingEvents.length === 0) {
			return undefined;
		}

		let cancelled = false;
		const rawFrom = scrubRef.current;
		const maxStart = maxAxisRef.current;
		const minStart = minAxisRef.current;
		const spanStart = axisSpanRef.current;

		const from = Math.min(Math.max(rawFrom, minStart), maxStart);

		if (from >= maxStart) {
			setPlaying(false);
			return undefined;
		}

		const remainder = Math.max(maxStart - from, 1);
		const timelineSpan = Math.max(spanStart, 1);
		const playWallMsBase = Math.max(600, Math.min(28_000, (remainder / timelineSpan) * 28_000));
		// Playback presets were uniformly too brisk; ×2 duration halves effective speed at each multiplier.
		const playWallMs = (2 * playWallMsBase) / playbackSpeed;
		const wallT0 = performance.now();

		function tickFrame(nowWall: number) {
			if (cancelled) {
				return;
			}

			const p = Math.min(1, (nowWall - wallT0) / playWallMs);
			const next = from + remainder * p;

			setScrubTimeMs(Math.min(Math.max(next, minAxisRef.current), maxAxisRef.current));

			if (p >= 1) {
				queueMicrotask(() => {
					setPlaying(false);
				});
				return;
			}

			requestAnimationFrame(tickFrame);
		}

		requestAnimationFrame(tickFrame);

		return () => {
			cancelled = true;
		};
	}, [playbackSpeed, playing, workingEvents.length]);

	const rangeStep = useMemo(() => {
		const coarse = axisSpan / 1500;
		return Math.min(axisSpan, Math.max(1000, Math.floor(coarse)));
	}, [axisSpan]);

	const folderBySlug = useMemo(() => {
		const m = new Map<string, FolderDocument>();
		for (const f of evo?.folders ?? []) {
			m.set(f.slug, f);
		}
		return m;
	}, [evo?.folders]);

	const chartMap = useMemo(
		() => (evo?.charts ? CreateChartIDMap(evo.charts) : new Map()),
		[evo?.charts],
	);
	const songMap = useMemo(
		() => (evo?.songs ? CreateSongMap(evo.songs) : new Map()),
		[evo?.songs],
	);

	const folderChartIDs = useMemo(() => evo?.folderChartIDs ?? {}, [evo?.folderChartIDs]);
	const replayRows = useMemo(() => {
		if (!open || !evo) {
			return [] as Array<{ folder: FolderDocument; stats: FolderStatsInfo }>;
		}

		const applied = appliedEvents;
		const rows: Array<{ folder: FolderDocument; stats: FolderStatsInfo }> = [];

		for (const slug of folderSlugOrder) {
			const folder = folderBySlug.get(slug);

			if (!folder) {
				continue;
			}

			const stats = buildEvolutionReplayFolderStats({
				enumMetric,
				eventsPrefix: applied,
				folderChartIDs,
				folderSlug: slug,
				gameConfig,
			});

			rows.push({ folder, stats });
		}

		return rows;
	}, [
		appliedEvents,
		enumMetric,
		evo,
		folderBySlug,
		folderChartIDs,
		folderSlugOrder,
		gameConfig,
		open,
	]);

	useLayoutEffect(() => {
		if (!open || workingEvents.length === 0) {
			setMilestoneFeedFrameHeightPx(0);
			return;
		}

		const el = foldersReplayPanelRef.current;
		if (!el) {
			return;
		}

		let rafId = 0;

		const syncHeight = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const h = el.getBoundingClientRect().height;
				const next = Boolean(h) && Number.isFinite(h) ? Math.round(h * 1000) / 1000 : 0;
				setMilestoneFeedFrameHeightPx((prev) => (prev === next ? prev : next));
			});
		};

		syncHeight();

		const ro = new ResizeObserver(syncHeight);
		ro.observe(el);
		window.addEventListener("resize", syncHeight);

		return () => {
			cancelAnimationFrame(rafId);
			window.removeEventListener("resize", syncHeight);
			ro.disconnect();
		};
	}, [
		appliedEvents.length,
		enumMetric,
		open,
		replayRows.length,
		scrubTimeMs,
		replayDomId,
		workingEvents.length,
	]);

	useLayoutEffect(() => {
		const container = foldersReplayPanelRef.current;
		if (!container || replayRows.length === 0) {
			return;
		}

		const titles = container.querySelectorAll<HTMLElement>("[data-evo-folder-title]");
		if (!titles.length) {
			return;
		}

		const MAX_PX = 288;
		const maxW = Math.max(...Array.from(titles, (el) => el.scrollWidth));
		setEvoTitleWidth(Math.min(MAX_PX, maxW));
	}, [replayRows]);

	const allEnumColours = useMemo(
		() =>
			GPT_CLIENT_IMPLEMENTATIONS[game].enumColours as
				| Record<string, Record<string, string>>
				| undefined,
		[game],
	);

	const enumColours = useMemo(() => allEnumColours?.[enumMetric], [allEnumColours, enumMetric]);

	const feedRows = useMemo(() => [...appliedEvents].reverse(), [appliedEvents]);
	const visibleFeedRows = useMemo(() => feedRows.slice(0, MILESTONE_FEED_MAX_ROWS), [feedRows]);
	const _milestoneFeedTruncated = feedRows.length > MILESTONE_FEED_MAX_ROWS;

	const onPlayToggle = () => {
		if (workingEvents.length === 0) {
			return;
		}

		if (playing) {
			setPlaying(false);
			return;
		}

		if (scrubTimeMs >= maxAxis) {
			setScrubTimeMs(minAxis);
		}

		setPlaying(true);
	};

	const feedRowAccent = (metric: string, valueLabel: string): React.CSSProperties => {
		const raw = allEnumColours?.[metric]?.[valueLabel];
		const borderLeftColor = raw ?? "var(--bs-secondary)";
		let backgroundColor: string | undefined;
		if (raw?.startsWith("#") || raw?.startsWith("rgb")) {
			try {
				backgroundColor = ChangeOpacity(raw, 0.12);
			} catch {
				backgroundColor = undefined;
			}
		}
		return {
			borderLeftWidth: 4,
			borderLeftStyle: "solid",
			borderLeftColor,
			...(backgroundColor ? { backgroundColor } : {}),
		};
	};

	const rangeId = `evolution-replay-scrub-${replayDomId}`;
	const triggerLabelId = `evolution-replay-trigger-${replayDomId}`;
	const collapseId = `evolution-replay-collapse-${replayDomId}`;

	return (
		<section
			aria-labelledby={triggerLabelId}
			className="border border-secondary border-opacity-50 bg-body-tertiary bg-opacity-10 mb-4 px-3 py-4 rounded-4 shadow-sm"
		>
			<div className="d-flex justify-content-center px-2">
				<Button
					aria-controls={collapseId}
					aria-expanded={open}
					className="align-items-center d-flex flex-column flex-sm-row gap-2 gap-sm-3 fw-bold justify-content-center px-4 px-md-5 py-3 rounded-3 shadow-sm text-nowrap"
					onClick={() => {
						setOpen((v) => !v);
					}}
					size="lg"
					style={{ maxWidth: "36rem", width: "100%" }}
					variant="primary"
				>
					<Icon
						aria-hidden
						className="opacity-90"
						type={open ? "chevron-up" : "chevron-down"}
					/>
					<span className="text-center" id={triggerLabelId}>
						{scope.kind === "table"
							? "Watch table progress over time"
							: "Watch folder progress over time"}
					</span>
				</Button>
			</div>

			{enumMetricChoices.length > 1 ? (
				<div className="d-flex justify-content-center mt-3 mb-2 px-2">
					<div className="d-flex flex-wrap justify-content-center gap-2">
						{enumMetricChoices.map((metric) => (
							<SelectButton
								className="text-wrap"
								id={metric}
								key={metric}
								setValue={setEnumMetric}
								value={enumMetric}
							>
								<Icon
									type={
										/* @ts-expect-error enum icon keys align with score metrics */
										GPT_CLIENT_IMPLEMENTATIONS[game].enumIcons[metric]
									}
								/>{" "}
								{UppercaseFirst(metric)}
							</SelectButton>
						))}
					</div>
				</div>
			) : null}

			<Collapse in={open}>
				<div className={enumMetricChoices.length > 1 ? "mt-2" : "mt-3"} id={collapseId}>
					{evoError ? <ApiError error={evoError} /> : null}

					{open && evolutionLoading ? <Loading /> : null}

					{evo && !evolutionLoading && !evoError ? (
						<>
							{events.length === 0 ? (
								<small className="d-block mb-3 text-body-secondary">
									{scope.kind === "table"
										? "Nothing, yet for this table."
										: "Nothing, yet for this folder."}
								</small>
							) : (
								<>
									<div className="row g-4">
										<div className="col-12">
											<EvolutionTimelineStrip
												allEnumColours={allEnumColours}
												axisSpan={axisSpan}
												enumMetric={enumMetric}
												gameConfig={gameConfig}
												maxAxis={maxAxis}
												minAxis={minAxis}
												rangeId={rangeId}
												rangeStep={rangeStep}
												scrubTimeMs={scrubTimeMs}
												setPlaying={setPlaying}
												setScrubTimeMs={setScrubTimeMs}
												workingEvents={workingEvents}
											/>

											<div
												className="border-primary border-opacity-50 bg-primary bg-opacity-10 border min-w-0 mt-4 px-3 py-4 rounded-4 shadow-sm text-center w-100"
												style={{ borderWidth: "2px" }}
											>
												<div className="fw-semibold lh-sm pb-2 small text-body-secondary text-uppercase">
													Current replay time
												</div>

												<div
													className="display-5 fw-bold text-body-emphasis tabular-nums text-truncate"
													title={FormatDate(scrubTimeMs)}
												>
													{FormatDate(scrubTimeMs)}
												</div>

												<div
													className="lh-sm mt-2 text-truncate"
													title={MillisToSince(scrubTimeMs) ?? undefined}
												>
													<Muted>{MillisToSince(scrubTimeMs)}</Muted>
												</div>
											</div>

											<div className="d-flex justify-content-center flex-wrap align-items-stretch gap-3 mt-4">
												<Button
													className="align-items-center d-inline-flex fw-bold gap-3 px-5 py-3 shadow-sm"
													onClick={onPlayToggle}
													size="lg"
													type="button"
													variant="success"
												>
													<Icon
														aria-hidden
														className="fs-3"
														type={playing ? "pause" : "play"}
													/>
													<span>
														{playing ? "Pause replay" : "Play replay"}
													</span>
												</Button>

												<div className="d-flex align-items-center">
													<Dropdown>
														<Dropdown.Toggle
															className="h-100"
															id={`replay-playback-menu-${replayDomId}`}
															variant="outline-secondary"
														>
															<span className="d-inline-flex align-items-center gap-2 fw-semibold">
																<span>Playback</span>
																<span className="small tabular-nums text-body-secondary">
																	{playbackSpeed}&times;
																</span>
															</span>
														</Dropdown.Toggle>
														<Dropdown.Menu>
															{PLAYBACK_SPEED_OPTIONS.map((rate) => (
																<Dropdown.Item
																	active={playbackSpeed === rate}
																	as="button"
																	key={rate}
																	onClick={() =>
																		setPlaybackSpeed(rate)
																	}
																	type="button"
																>
																	{rate}&times;
																	{rate === 1 ? (
																		<span className="text-body-secondary small ms-1">
																			(normal)
																		</span>
																	) : null}
																</Dropdown.Item>
															))}
														</Dropdown.Menu>
													</Dropdown>
												</div>
											</div>
										</div>
									</div>

									<div className="row g-4 mt-4">
										<div className="col-12 col-lg-7">
											<h6 className="text-body-secondary mb-3">
												{scope.kind === "table"
													? "Folders at"
													: "Folder at"}{" "}
												<span className="fw-semibold tabular-nums text-body-emphasis">
													{FormatDate(scrubTimeMs)}
												</span>
											</h6>
											<div
												className="border bg-body-secondary bg-opacity-10 gap-1 rounded vstack px-3 py-2"
												ref={foldersReplayPanelRef}
												style={
													evoTitleWidth !== null
														? ({
																"--folder-title-w": `${evoTitleWidth}px`,
															} as React.CSSProperties)
														: undefined
												}
											>
												{replayRows.map(({ folder, stats }) => (
													<div
														className={`${folderTableStyles.folderRow} bg-body-tertiary bg-opacity-25 mb-0`}
														key={folder.slug}
													>
														<div className="d-flex flex-column flex-lg-row align-items-lg-center gap-1 gap-lg-2">
															<div
																className={`fw-semibold text-truncate ${folderTableStyles.folderRowTitle}`}
																data-evo-folder-title
															>
																{folder.title}
															</div>
															<div
																className="flex-grow-1 min-w-0"
																style={{
																	minWidth: "10rem",
																}}
															>
																<FolderEnumProgressBar
																	animateSegments={false}
																	clipToMinimumRelevance
																	colours={enumColours}
																	enumMetric={enumMetric}
																	gameConfig={gameConfig}
																	stats={stats}
																/>
															</div>
															<span
																className={`text-body-secondary ${folderTableStyles.folderRowChartMeta}`}
															>
																<span
																	className={
																		folderTableStyles.folderRowChartCount
																	}
																>
																	{stats.chartCount}
																</span>
															</span>
														</div>
														{scope.kind === "folder" ? (
															<FolderEnumDistributionBreakdown
																clipToMinimumRelevance
																colours={enumColours}
																enumMetric={enumMetric}
																gameConfig={gameConfig}
																remainderLabel="Unfilled bar (no qualifying milestone)"
																stats={stats}
															/>
														) : null}
													</div>
												))}
											</div>
										</div>
										<div className="col-12 col-lg-5">
											<div className="mb-3">
												<h6 className="mb-1 text-body-secondary">Scores</h6>
											</div>
											<div
												className="border bg-body-secondary bg-opacity-10 d-flex flex-column gap-3 overflow-auto px-3 py-3 rounded-3"
												style={{
													minHeight: "400px",
													overflowX: "hidden",
													...(milestoneFeedFrameHeightPx > 0
														? {
																height: milestoneFeedFrameHeightPx,
															}
														: {}),
												}}
											>
												{visibleFeedRows.length === 0 ? (
													<small className="d-block mb-1 text-body-secondary">
														Nothing before this position.
													</small>
												) : (
													visibleFeedRows.map((evRow) => {
														const chart = chartMap.get(evRow.chartID);
														const song = chart
															? songMap.get(chart.song.id)
															: undefined;

														const chipFill =
															allEnumColours?.[evRow.metric]?.[
																evRow.value
															];
														let chipBg: string | undefined;
														if (
															chipFill &&
															(chipFill.startsWith("#") ||
																chipFill.startsWith("rgb"))
														) {
															try {
																chipBg = ChangeOpacity(
																	chipFill,
																	0.2,
																);
															} catch {
																chipBg = undefined;
															}
														}

														return (
															<EvolutionMilestoneFeedRow
																articleStyle={feedRowAccent(
																	evRow.metric,
																	evRow.value,
																)}
																chart={chart}
																chipBg={chipBg}
																chipFill={chipFill}
																evRow={evRow}
																game={game}
																key={`${evRow.scoreID}-${evRow.metric}-${evRow.enumIndex}`}
																song={song}
															/>
														);
													})
												)}
											</div>
										</div>
									</div>
								</>
							)}
						</>
					) : null}
				</div>
			</Collapse>
		</section>
	);
}
