import { ErrorPage } from "#app/pages/ErrorPage";
import FolderInfoHeader from "#components/game/folder/FolderInfoHeader";
import QuickTooltip from "#components/layout/misc/QuickTooltip";
import DifficultyCell from "#components/tables/cells/DifficultyCell";
import MiniTable from "#components/tables/components/MiniTable";
import FolderTable, {
	FOLDER_FOLDER_TABLE_SCROLL_INTO_VIEW_ID,
	type FolderEnumBreakdownTablePreset,
} from "#components/tables/folders/FolderTable";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import ReferToUser from "#components/util/ReferToUser";
import SelectButton from "#components/util/SelectButton";
import SelectLinkButton from "#components/util/SelectLinkButton";
import useUGPTBase from "#components/util/useUGPTBase";
import { WindowContext } from "#context/WindowContext";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GPTRatingSystem } from "#lib/types";
import { type UGPTFolderReturns } from "#types/api-returns";
import { type FolderDataset } from "#types/tables";
import { ChangeOpacity } from "#util/color-opacity";
import { CreateChartIDMap, CreateChartLink, CreateSongMap } from "#util/data";
import { DistinctArr, ToFixedFloor } from "#util/misc";
import { NumericSOV, StrSOV } from "#util/sorts";
import React, {
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Col, Collapse, Form, Row } from "react-bootstrap";
import {
	Link,
	Redirect,
	Route,
	Switch,
	useHistory,
	useLocation,
	useParams,
} from "react-router-dom";
import {
	COLOUR_SET,
	EnumIndexToValue,
	FormatDifficultyShort,
	GetGameConfig,
	GetScoreEnumConfs,
	type integer,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import FolderComparePage from "./FolderComparePage";
import FolderQuestsPage from "./FolderQuestsPage";
import tierlistStyles from "./SpecificFolderPage.module.scss";
import TableEvolutionReplay from "./TableEvolutionReplay";

/** Extra offset when jumping from breakdown → folder table (`scrollIntoView` start − this). */
const FOLDER_BREAKDOWN_TABLE_SCROLL_EXTRA_OFFSET_PX = 50;

const FOLDER_TIERLIST_USE_FANCY_COLOUR_LS_KEY = "tachi.folderTierlist.useFancyColours";

function readStoredFolderTierlistUseFancyColour(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return window.localStorage.getItem(FOLDER_TIERLIST_USE_FANCY_COLOUR_LS_KEY) === "true";
}

function persistFolderTierlistUseFancyColour(useFancy: boolean): void {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(
		FOLDER_TIERLIST_USE_FANCY_COLOUR_LS_KEY,
		useFancy ? "true" : "false",
	);
}

interface Props {
	reqUser: UserDocument;
	game: V3Game;
}

export default function SpecificFolderPage({ reqUser, game }: Props) {
	const { folderSlug } = useParams<{ folderSlug: string }>();

	const { data, error } = useApiQuery<UGPTFolderReturns>(
		`/users/${reqUser.id}/games/${game}/folders/${folderSlug}`,
	);

	const folderDataset = useMemo(() => {
		if (!data) {
			return null;
		}

		const songMap = CreateSongMap(data.songs);
		const pbMap = CreateChartIDMap(data.pbs);

		const folderDataset: FolderDataset = [];

		for (const chart of data.charts) {
			folderDataset.push({
				...chart,
				__related: {
					pb: pbMap.get(chart.chartID) ?? null,
					song: songMap.get(chart.song.id)!,
					user: reqUser,
				},
			});
		}

		folderDataset.sort(StrSOV((x) => x.__related.song.title));

		return folderDataset;
	}, [data, reqUser]);

	const [folderTableEnumPreset, setFolderTableEnumPreset] =
		useState<FolderEnumBreakdownTablePreset | null>(null);

	const onBreakdownEnumValueClick = useCallback((metricKey: string, valueLabel: string) => {
		setFolderTableEnumPreset((p) => ({
			metricKey,
			valueLabel,
			nonce: (p?.nonce ?? 0) + 1,
		}));

		queueMicrotask(() => {
			const anchor = document.getElementById(FOLDER_FOLDER_TABLE_SCROLL_INTO_VIEW_ID);
			if (!anchor) {
				return;
			}

			const y =
				anchor.getBoundingClientRect().top +
				window.scrollY -
				FOLDER_BREAKDOWN_TABLE_SCROLL_EXTRA_OFFSET_PX;
			window.scrollTo({ top: Math.max(0, y) });
		});
	}, []);

	const folderInfoHeader = useMemo(() => {
		if (!folderDataset || !data) {
			return <Loading />;
		}

		return (
			<FolderInfoHeader
				folderSlug={folderSlug}
				folderTitle={data.folder.title}
				game={game}
				onBreakdownEnumValueClick={onBreakdownEnumValueClick}
				reqUser={reqUser}
			/>
		);
	}, [data, folderSlug, folderDataset, game, onBreakdownEnumValueClick, reqUser]);

	const base = `${useUGPTBase({ reqUser, game })}/folders/${folderSlug}`;

	if (error?.statusCode === 404) {
		return (
			<ErrorPage
				customMessage={error.description ?? "This folder does not exist."}
				statusCode={404}
			/>
		);
	}

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data || !folderDataset) {
		return <Loading />;
	}

	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	return (
		<div className="row">
			<div className="col-12">{folderInfoHeader}</div>
			<div className="col-12">
				<Divider />
			</div>
			<div className="col-12 d-flex">
				<div className="btn-group overflow-x-auto scrollbar-hide d-flex w-100">
					<SelectLinkButton className="text-wrap" to={base}>
						<Icon type="table" /> Normal View
					</SelectLinkButton>
					{gptImpl.ratingSystems.length !== 0 &&
						// temp: tierlist view sucks for BMS and PMS
						game !== "bms-7k" &&
						game !== "bms-14k" &&
						game !== "pms-controller" &&
						game !== "pms-keyboard" && (
							<SelectLinkButton className="text-wrap" to={`${base}/tierlist`}>
								<Icon type="sort-alpha-up" /> Tierlist View
							</SelectLinkButton>
						)}
					<SelectLinkButton className="text-wrap" to={`${base}/compare`}>
						<Icon type="users" /> Compare Against User
					</SelectLinkButton>
					<SelectLinkButton className="text-wrap" to={`${base}/targets`}>
						<Icon type="scroll" /> Goals & Quests
					</SelectLinkButton>
				</div>
			</div>
			<div className="col-12">
				<Divider />
			</div>
			<div className="col-12">
				<Switch>
					<Route exact path={base}>
						<FolderNormalView
							data={data}
							folderDataset={folderDataset}
							folderTableEnumPreset={folderTableEnumPreset}
							game={game}
							reqUser={reqUser}
						/>
					</Route>
					<Route exact path={`${base}/tierlist`}>
						<TierlistBreakdown
							data={data}
							folderDataset={folderDataset}
							game={game}
							reqUser={reqUser}
						/>
					</Route>
					<Route exact path={`${base}/timeline`}>
						<Redirect to={base} />
					</Route>
					<Route exact path={`${base}/compare`}>
						<FolderComparePage folder={data.folder} game={game} reqUser={reqUser} />
					</Route>
					<Route exact path={`${base}/targets`}>
						<FolderQuestsPage folder={data.folder} game={game} reqUser={reqUser} />
					</Route>
				</Switch>
			</div>
		</div>
	);
}

function FolderNormalView({
	data,
	folderDataset,
	folderTableEnumPreset,
	game,
	reqUser,
}: {
	data: UGPTFolderReturns;
	folderDataset: FolderDataset;
	folderTableEnumPreset: FolderEnumBreakdownTablePreset | null;
} & Props) {
	const gameConfig = useMemo(() => GetGameConfig(game), [game]);

	const evolutionFolderScope = useMemo(
		() => ({ folder: data.folder, kind: "folder" as const }),
		[data.folder],
	);

	return (
		<>
			<TableEvolutionReplay
				game={game}
				gameConfig={gameConfig}
				reqUser={reqUser}
				scope={evolutionFolderScope}
			/>
			<Divider />
			<FolderTable
				dataset={folderDataset}
				folderBreakdownEnumTablePreset={folderTableEnumPreset}
				game={game}
			/>
		</>
	);
}

// here be demons
// i don't remember how this code works
// and i was almost certainly drinking heavily when i wrote it
// so

type InfoProps = {
	data: UGPTFolderReturns;
	folderDataset: FolderDataset;
} & Props;

function TierlistBreakdown({ game, folderDataset, reqUser }: InfoProps) {
	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	const history = useHistory();
	const location = useLocation();

	const canonicalFirstTier = gptImpl.ratingSystems[0]?.name ?? "";

	const tierlist = useMemo((): string => {
		const systems = gptImpl.ratingSystems as GPTRatingSystem<V3Game>[];
		const fromQs = new URLSearchParams(location.search).get("tierlist");
		if (!fromQs) {
			return canonicalFirstTier;
		}
		const match = systems.find((s) => s.name === fromQs);
		return match ? match.name : canonicalFirstTier;
	}, [canonicalFirstTier, gptImpl.ratingSystems, location.search]);

	const commitTierlistToUrl = useCallback(
		(next: SetStateAction<string>) => {
			const name = typeof next === "function" ? next(tierlist) : next;
			const nextQs = new URLSearchParams(location.search);
			nextQs.set("tierlist", name);
			const s = nextQs.toString();
			history.push({
				pathname: location.pathname,
				search: s.length > 0 ? `?${s}` : "",
			});
		},
		[history, location.pathname, location.search, tierlist],
	);

	useEffect(() => {
		const systems = gptImpl.ratingSystems as GPTRatingSystem<V3Game>[];
		if (systems.length === 0) {
			return;
		}

		const nextQs = new URLSearchParams(location.search);
		const raw = nextQs.get("tierlist");
		if (!raw || !systems.some((s) => s.name === raw)) {
			nextQs.set("tierlist", systems[0].name);
			const s = nextQs.toString();
			history.replace({
				pathname: location.pathname,
				search: s.length > 0 ? `?${s}` : "",
			});
		}
	}, [gptImpl.ratingSystems, history, location.pathname, location.search]);

	const [useFancyColour, setUseFancyColour] = useState(readStoredFolderTierlistUseFancyColour);
	const [forceGridView, setForceGridView] = useState(false);

	const playerStats = useMemo(
		() => FolderDatasetAchievedStatus(folderDataset, game, tierlist),
		[folderDataset, game, tierlist],
	);

	const tierlistImpl = (gptImpl.ratingSystems as GPTRatingSystem<V3Game>[]).find(
		(rs) => rs.name === tierlist,
	);

	if (!tierlistImpl) {
		return <>(E) no tierlist impl (howd you get here?)</>;
	}

	return (
		<Row>
			{gptImpl.ratingSystems.length > 1 && (
				<Col xs={12}>
					<div className="btn-group d-flex">
						{gptImpl.ratingSystems.map((e) => (
							<SelectButton
								className="btn-lg"
								id={e.name}
								key={e.name}
								setValue={commitTierlistToUrl}
								value={tierlist}
							>
								{e.name}
								<br />
								{e.description}
							</SelectButton>
						))}
					</div>
				</Col>
			)}
			<Col xs={12}>
				<Divider />
				<Form.Check
					checked={!useFancyColour}
					label="Use simple clear/fail colours"
					onChange={() => {
						setUseFancyColour((e) => {
							const next = !e;
							persistFolderTierlistUseFancyColour(next);
							return next;
						});
					}}
					type="checkbox"
				/>
				<Form.Text>
					<span>
						If enabled, this will show green when you've achieved the tierlist
						requirements, and red if you haven't, instead of fancier colours.
					</span>
				</Form.Text>
				{/* <Form.Check
					className="d-block d-lg-none"
					type="checkbox"
					checked={forceGridView}
					onChange={() => {
						setForceGridView((e) => !e);
					}}
					label="Force desktop grid view"
				/> */}
				<Divider />
			</Col>
			<Col xs={12}>
				<TierlistInfoLadder
					folderDataset={folderDataset}
					forceGridView={forceGridView}
					game={game}
					playerStats={playerStats}
					reqUser={reqUser}
					tierlistImpl={tierlistImpl}
					useFancyColour={useFancyColour}
				/>
			</Col>
		</Row>
	);
}

const TIERLIST_NOT_PLAYED_BUCKET_KEY = "__NOT_PLAYED__";
const TIERLIST_UNKNOWN_BUCKET_KEY = "__UNKNOWN__";

function tierlistRowEnumBucketKey(row: TierlistInfo, game: V3Game, enumMetric: string): string {
	if (row.status === AchievedStatuses.NOT_PLAYED || !row.chart.__related.pb) {
		return TIERLIST_NOT_PLAYED_BUCKET_KEY;
	}
	if (typeof row.score === "string" && row.score.length > 0) {
		return row.score;
	}

	const pb = row.chart.__related.pb;
	const idx = (pb.scoreData.enumIndexes as Record<string, integer | undefined>)[enumMetric];
	if (typeof idx !== "number") {
		return TIERLIST_UNKNOWN_BUCKET_KEY;
	}

	try {
		const label = EnumIndexToValue(
			game,
			// @ts-expect-error GPTRatingSystem.enumName matches score enums on this GPT
			enumMetric,
			idx,
		);
		return label;
	} catch {
		return TIERLIST_UNKNOWN_BUCKET_KEY;
	}
}

interface TierlistBucketBarSegment {
	count: number;
	fill: string;
	label: string;
}

function computeTierlistBucketBarModel(
	bucket: TierlistInfo[],
	game: V3Game,
	tierlistImpl: GPTRatingSystem<V3Game>,
	useFancyColour: boolean,
): { achieved: number; segments: TierlistBucketBarSegment[]; total: number } {
	const total = bucket.length;

	let achieved = 0;
	for (const row of bucket) {
		if (row.status === AchievedStatuses.ACHIEVED) {
			achieved++;
		}
	}

	const mutedBg = "var(--bs-secondary-bg)";

	if (!useFancyColour) {
		// Left → right: strongest progress first; "not played" on the far right.
		const meta = [
			{ internal: "__OK__", fill: "var(--bs-success)", label: "Done" },
			{ internal: "__SB__", fill: "var(--bs-info)", label: "Score only" },
			{ internal: "__FAIL__", fill: "var(--bs-danger)", label: "Not met" },
			{ internal: "__NP__", fill: mutedBg, label: "Not played" },
		] as const;
		const tallies = new Map<string, number>(meta.map(({ internal }) => [internal, 0]));

		for (const row of bucket) {
			let k: "__FAIL__" | "__NP__" | "__OK__" | "__SB__";

			switch (row.status) {
				case AchievedStatuses.NOT_PLAYED:
					k = "__NP__";
					break;

				case AchievedStatuses.FAILED:
					k = "__FAIL__";
					break;

				case AchievedStatuses.ACHIEVED:
					k = "__OK__";
					break;

				default:
					k = "__SB__";
					break;
			}
			const next = tallies.get(k)! + 1;

			tallies.set(k, next);
		}

		const segments = meta
			.map((entry) => ({
				fill: entry.fill,
				label: entry.label,
				count: tallies.get(entry.internal)!,
			}))
			.filter((s) => s.count > 0);

		return { achieved, segments, total };
	}

	const enumMetric = tierlistImpl.enumName;
	const conf = GetScoreEnumConfs(GetGameConfig(game))[enumMetric];
	const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

	const counts = new Map<string, number>();
	for (const row of bucket) {
		const key = tierlistRowEnumBucketKey(row, game, enumMetric);

		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	function resolveFill(key: string): string {
		if (key === TIERLIST_NOT_PLAYED_BUCKET_KEY || key === TIERLIST_UNKNOWN_BUCKET_KEY) {
			return mutedBg;
		}

		// Mirrors fancy colours on tier cards.
		// @ts-expect-error enumColours keying on dynamic lamp/grade string
		return gptImpl.enumColours[tierlistImpl.enumName][key] ?? mutedBg;
	}

	const orderedKeys: string[] = [];

	// Left → right: best enum outcome first (end of conf.values[]); "not played" last.
	if (conf?.type === "ENUM") {
		for (let vi = conf.values.length - 1; vi >= 0; vi--) {
			const v = conf.values[vi];
			if ((counts.get(v) ?? 0) > 0) {
				orderedKeys.push(v);
			}
		}
	} else {
		const restKeys = [...counts.keys()].filter(
			(k) => k !== TIERLIST_NOT_PLAYED_BUCKET_KEY && k !== TIERLIST_UNKNOWN_BUCKET_KEY,
		);
		for (const k of restKeys.sort(StrSOV((x) => x)).reverse()) {
			if ((counts.get(k) ?? 0) > 0) {
				orderedKeys.push(k);
			}
		}
	}

	const unk = counts.get(TIERLIST_UNKNOWN_BUCKET_KEY) ?? 0;
	const np = counts.get(TIERLIST_NOT_PLAYED_BUCKET_KEY) ?? 0;

	if (unk > 0) {
		orderedKeys.push(TIERLIST_UNKNOWN_BUCKET_KEY);
	}
	if (np > 0) {
		orderedKeys.push(TIERLIST_NOT_PLAYED_BUCKET_KEY);
	}

	const segments: TierlistBucketBarSegment[] = orderedKeys.map((key) => ({
		label:
			key === TIERLIST_NOT_PLAYED_BUCKET_KEY
				? "Not played"
				: key === TIERLIST_UNKNOWN_BUCKET_KEY
					? "Unknown"
					: key,

		count: counts.get(key) ?? 0,
		fill: resolveFill(key),
	}));

	return { achieved, segments, total };
}

function tierlistBucketBarSegmentFill(seg: TierlistBucketBarSegment): string {
	return seg.fill.startsWith("var(") ? seg.fill : ChangeOpacity(seg.fill, 0.92);
}

const TIERLIST_BAR_HEIGHT = "1.625rem";

const MIN_TIERLIST_SEGMENT_WIDTH_PX_FOR_INLINE_LABEL = 30;

function TierlistBucketProgressBar({
	segments,
	total,
}: {
	segments: TierlistBucketBarSegment[];
	total: number;
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

	if (total === 0 || segments.every((s) => s.count === 0)) {
		return null;
	}

	const visible = segments.filter((s) => s.count > 0);
	let filled = 0;
	for (const s of visible) {
		filled += s.count;
	}
	const remainderWidthPct = total > 0 ? (100 * Math.max(0, total - filled)) / total : 0;

	return (
		<div
			className={`border overflow-hidden rounded-3 ${tierlistStyles.tierlistBar}`}
			dir="ltr"
			lang="en"
			ref={barRef}
			style={{
				backgroundColor: "var(--bs-secondary-bg)",
				direction: "ltr",
				display: "block",
				height: TIERLIST_BAR_HEIGHT,
				minHeight: "1.25rem",
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
				{visible.map((seg, segIndex) => {
					const pct = total > 0 ? (100 * seg.count) / total : 0;
					const fill = tierlistBucketBarSegmentFill(seg);
					const segmentWidthPx = barWidthPx > 0 ? (pct / 100) * barWidthPx : 0;
					const showInlinePct =
						segmentWidthPx >= MIN_TIERLIST_SEGMENT_WIDTH_PX_FOR_INLINE_LABEL;
					const inlinePctText = `${Math.round(pct)}%`;

					return (
						<QuickTooltip
							key={`${seg.label}-${seg.fill}-${segIndex}`}
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
								className={`h-100 ${tierlistStyles.tierlistBarSegment}`}
								style={{
									animationDelay: `${0.05 + segIndex * 0.055}s`,
									backgroundColor: fill,
									flex: "none",
									minWidth: seg.count ? "4px" : 0,
									width: `${pct}%`,
								}}
							>
								{showInlinePct && (
									<span className={tierlistStyles.tierlistBarLabel}>
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
						className={`h-100 ${tierlistStyles.tierlistBarRemainder}`}
						style={{
							animationDelay: `${0.05 + visible.length * 0.055}s`,
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

function tierlistBucketTitleText(bucket: TierlistInfo[]): string {
	const inner = DistinctArr(bucket.map((e) => e.text ?? "No Tierlist Data")).join(", ");
	const value = bucket[0].value;
	if (value !== null && value !== undefined) {
		return `${value} (${inner})`;
	}
	return inner;
}

function TierlistBucketsSummaryTable({
	buckets,
	expandedBucketIndices,
	game,
	onTierActivate,
	tierlistImpl,
	useFancyColour,
}: {
	buckets: TierlistInfo[][];
	expandedBucketIndices: Set<number>;
	game: V3Game;
	onTierActivate: (bucketIndex: number) => void;
	tierlistImpl: GPTRatingSystem<V3Game>;
	useFancyColour: boolean;
}) {
	if (buckets.length === 0) {
		return null;
	}

	return (
		<Row className="mb-4">
			<Col xs={12}>
				<h5 className="mb-2 text-body-secondary">Summary</h5>
				<div className="table-responsive">
					<table className="mb-0 table table-bordered table-sm align-middle tierlist-summary-table">
						<thead>
							<tr>
								<th className="text-start text-nowrap">Tier</th>
								<th className="text-start" style={{ minWidth: "12rem" }}>
									Distribution
								</th>
								<th
									className={`text-center text-nowrap ${tierlistStyles.tierlistSummaryMetHeader}`}
								>
									Met
								</th>
							</tr>
						</thead>
						<tbody>
							{buckets.map((bucket, i) => {
								const barModel = computeTierlistBucketBarModel(
									bucket,
									game,
									tierlistImpl,
									useFancyColour,
								);
								const tierKey =
									bucket[0].value !== null && bucket[0].value !== undefined
										? String(bucket[0].value)
										: "novalue";
								const toGo = barModel.total - barModel.achieved;
								const tierComplete =
									barModel.total > 0 && barModel.achieved === barModel.total;

								return (
									<tr
										aria-controls={`tierlist-bucket-panel-${i}`}
										aria-expanded={expandedBucketIndices.has(i)}
										className="tierlist-summary-row"
										key={`tierlist-summary-${tierKey}-${i}`}
										onClick={() => onTierActivate(i)}
										onKeyDown={(evt) => {
											if (evt.key === "Enter" || evt.key === " ") {
												evt.preventDefault();
												onTierActivate(i);
											}
										}}
										role="button"
										tabIndex={0}
									>
										<td className="fw-medium text-nowrap">
											{tierlistBucketTitleText(bucket)}
										</td>
										<td className="py-2">
											<div className="w-100" dir="ltr" lang="en">
												<TierlistBucketProgressBar
													segments={barModel.segments}
													total={barModel.total}
												/>
											</div>
										</td>
										<td className="text-center">
											<div className="align-items-center d-flex flex-column gap-0">
												<div
													className={`fw-bold ${tierlistStyles.tierlistMetFraction} ${tierlistStyles.tierlistMetFractionCenter}`}
												>
													<span
														className={
															tierComplete
																? "text-success"
																: barModel.achieved === 0
																	? "text-body-secondary"
																	: "text-body"
														}
													>
														{barModel.achieved}
													</span>
													<span className="fs-6 fw-semibold text-body-secondary">
														/
													</span>
													<span className="fs-6 fw-semibold text-body-secondary">
														{barModel.total}
													</span>
												</div>
												{toGo > 0 && toGo < 5 ? (
													<span className="small text-body-secondary text-nowrap">
														{`${toGo} to go!`}
													</span>
												) : null}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Col>
		</Row>
	);
}

function TierlistInfoLadder({
	playerStats,
	game,
	reqUser,
	folderDataset,
	tierlistImpl,
	useFancyColour,
	forceGridView,
}: {
	folderDataset: FolderDataset;
	forceGridView: boolean;
	game: V3Game;
	playerStats: Record<string, { score: string | null; status: AchievedStatuses }>;
	reqUser: UserDocument;
	tierlistImpl: GPTRatingSystem<V3Game>;
	useFancyColour: boolean;
}) {
	const buckets: TierlistInfo[][] = useMemo(() => {
		const buckets: TierlistInfo[][] = [];

		const allData: TierlistInfo[] = [];

		for (const d of folderDataset) {
			const { status, score } = playerStats[d.chartID] ?? AchievedStatuses.NOT_PLAYED;

			allData.push({
				status,
				score,
				chart: d,
				text: tierlistImpl.toString(d),
				value: tierlistImpl.toNumber(d),
				idvDiff: tierlistImpl.idvDifference(d),
			});
		}

		allData.sort(NumericSOV((x) => x.value ?? -Infinity, true));

		let bucket: TierlistInfo[] = [];
		const noTierlistInfoBucket: TierlistInfo[] = [];

		let lastNum: number | null = null;
		for (const d of allData) {
			if (typeof d.value !== "number") {
				noTierlistInfoBucket.push(d);
				continue;
			}

			if (lastNum !== d.value) {
				buckets.push(bucket);

				// go again
				bucket = [d];
			} else {
				bucket.push(d);
			}

			lastNum = d.value;
		}

		if (bucket.length > 0) {
			buckets.push(bucket);
		}

		if (noTierlistInfoBucket.length > 0) {
			buckets.push(noTierlistInfoBucket);
		}

		for (const bucket of buckets) {
			bucket.sort(StrSOV((s) => s.text ?? "NO DATA"));
		}

		return buckets;
	}, [folderDataset, tierlistImpl, playerStats]);

	const nonEmptyBuckets = useMemo(() => buckets.filter((e) => e.length > 0), [buckets]);

	const [expandedBucketIndices, setExpandedBucketIndices] = useState<Set<number>>(
		() => new Set(),
	);

	useEffect(() => {
		setExpandedBucketIndices(new Set());
	}, [buckets]);

	const activateTierFromSummary = useCallback((i: number) => {
		setExpandedBucketIndices((prev) => {
			const next = new Set(prev);
			next.add(i);
			return next;
		});
		queueMicrotask(() => {
			document.getElementById(`tierlist-tier-section-${i}`)?.scrollIntoView({
				block: "start",
			});
		});
	}, []);

	return (
		<>
			<TierlistBucketsSummaryTable
				buckets={nonEmptyBuckets}
				expandedBucketIndices={expandedBucketIndices}
				game={game}
				onTierActivate={activateTierFromSummary}
				tierlistImpl={tierlistImpl}
				useFancyColour={useFancyColour}
			/>
			{nonEmptyBuckets.length === 0 ? (
				<Row className="justify-content-center">Got no tierlist data to show you!</Row>
			) : (
				nonEmptyBuckets.map((bucket, i) => {
					const expanded = expandedBucketIndices.has(i);
					const barModel = computeTierlistBucketBarModel(
						bucket,
						game,
						tierlistImpl,
						useFancyColour,
					);
					const toGo = barModel.total - barModel.achieved;
					const tierComplete = barModel.total > 0 && barModel.achieved === barModel.total;
					const tierKey =
						bucket[0].value !== null && bucket[0].value !== undefined
							? String(bucket[0].value)
							: "novalue";

					function toggleTierBucket() {
						setExpandedBucketIndices((prev) => {
							const next = new Set(prev);
							if (next.has(i)) {
								next.delete(i);
							} else {
								next.add(i);
							}
							return next;
						});
					}

					return (
						<div
							className="mb-4"
							id={`tierlist-tier-section-${i}`}
							key={`tierlist-tier-${tierKey}-${i}`}
							style={{ scrollMarginTop: "4.5rem" }}
						>
							<div className="w-100">
								<div
									aria-controls={`tierlist-bucket-panel-${i}`}
									aria-expanded={expanded}
									className="cursor-pointer mb-2 rounded-3 tierlist-collapsed-hit w-100"
									onClick={toggleTierBucket}
									onKeyDown={(evt) => {
										if (evt.key === "Enter" || evt.key === " ") {
											evt.preventDefault();
											toggleTierBucket();
										}
									}}
									role="button"
									tabIndex={0}
								>
									<div className="d-inline-flex flex-row justify-content-center align-items-center fs-3 px-3 py-2 text-body text-center w-100 gap-2 mb-2">
										<Icon type={expanded ? "chevron-down" : "chevron-right"} />
										<span>{tierlistBucketTitleText(bucket)}</span>
									</div>
									<div className="px-3 pb-3 w-100">
										<div className="align-items-baseline d-flex justify-content-between gap-3 mb-2">
											<div
												className={`fs-4 fw-bold tabular-nums ${tierlistStyles.tierlistMetFraction}`}
											>
												<span
													className={
														tierComplete
															? "text-success"
															: barModel.achieved === 0
																? "text-body-secondary"
																: "text-body"
													}
												>
													{barModel.achieved}
												</span>
												<span className="fs-6 fw-semibold text-body-secondary">
													/
												</span>
												<span className="fs-6 fw-semibold text-body-secondary">
													{barModel.total}
												</span>
											</div>
											{toGo > 0 && toGo < 5 ? (
												<span className="small text-body-secondary text-nowrap">{`${toGo} to go!`}</span>
											) : null}
										</div>
										<TierlistBucketProgressBar
											segments={barModel.segments}
											total={barModel.total}
										/>
									</div>
								</div>
							</div>

							<Collapse in={expanded}>
								<div id={`tierlist-bucket-panel-${i}`}>
									<TierlistBucket
										{...{
											bucket,
											game,
											reqUser,
											useFancyColour,
											tierlistImpl,
											forceGridView,
										}}
									/>
								</div>
							</Collapse>
						</div>
					);
				})
			)}
		</>
	);
}

function TierlistBucket({
	bucket,
	game,
	reqUser,
	useFancyColour,
	forceGridView,
	tierlistImpl,
}: {
	bucket: TierlistInfo[];
	forceGridView: boolean;
	game: V3Game;
	reqUser: UserDocument;
	tierlistImpl: GPTRatingSystem<V3Game>;
	useFancyColour: boolean;
}) {
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);
	// xs view is tabular
	if (!isLg && !forceGridView) {
		return (
			<MiniTable>
				{bucket.map((tierlistInfo, i) => (
					<TierlistInfoBucketValues
						bucket={bucket}
						forceGridView={forceGridView}
						game={game}
						i={i}
						key={`${tierlistInfo.chart.chartID}-${tierlistInfo.text}`}
						reqUser={reqUser}
						tierlistImpl={tierlistImpl}
						tierlistInfo={tierlistInfo}
						useFancyColour={useFancyColour}
					/>
				))}
			</MiniTable>
		);
	}

	return (
		<div className="grid text-center gap-2 grid-cols-md-4 grid-cols-lg-5 grid-cols-xl-6">
			{bucket.map((tierlistInfo, i) => (
				<TierlistInfoBucketValues
					bucket={bucket}
					forceGridView={forceGridView}
					game={game}
					i={i}
					key={`${tierlistInfo.chart.chartID}-${tierlistInfo.text}`}
					reqUser={reqUser}
					tierlistImpl={tierlistImpl}
					tierlistInfo={tierlistInfo}
					useFancyColour={useFancyColour}
				/>
			))}
		</div>
	);
}

function TierlistInfoBucketValues({
	tierlistInfo,
	game,
	reqUser,
	useFancyColour,
	forceGridView,
	tierlistImpl,
}: {
	bucket: TierlistInfo[];
	forceGridView: boolean;
	game: V3Game;
	i: integer;
	reqUser: UserDocument;
	tierlistImpl: GPTRatingSystem<V3Game>;
	tierlistInfo: TierlistInfo;
	useFancyColour: boolean;
}) {
	const { breakpoint } = useContext(WindowContext);

	const statusClasses: Record<AchievedStatuses, string> = {
		[AchievedStatuses.ACHIEVED]: "bg-success",
		[AchievedStatuses.FAILED]: "bg-danger",
		[AchievedStatuses.NOT_PLAYED]: "bg-body-tertiary",
		[AchievedStatuses.SCORE_BASED]: "bg-transparent",
	};

	let colourClass: string | undefined;
	let colourCss: string | undefined;

	if (useFancyColour) {
		const gptImpl = GPT_CLIENT_IMPLEMENTATIONS[game];

		// @ts-expect-error lol
		colourCss = gptImpl.enumColours[tierlistImpl.enumName][tierlistInfo.score];
	} else {
		colourClass = statusClasses[tierlistInfo.status];
	}

	if (tierlistInfo.status === AchievedStatuses.NOT_PLAYED) {
		colourClass = "bg-body-tertiary";
	}

	const data = tierlistInfo.chart;

	// xs view
	if (!breakpoint.isLg && !forceGridView) {
		return (
			<tr>
				<DifficultyCell alwaysShort chart={tierlistInfo.chart} game={game} noTierlist />
				<td className="text-start">
					<Link className="text-decoration-none" to={CreateChartLink(data)}>
						{tierlistInfo.chart.__related.song.title}
					</Link>{" "}
					<br />
					<div>
						{tierlistInfo.value} ({tierlistInfo.text ?? "No Info"})
						{tierlistInfo.idvDiff && (
							<span className="ms-1">
								<Icon type="balance-scale-left" />
							</span>
						)}
					</div>
				</td>
				<TierlistInfoCell colourCss={colourCss} tierlistInfo={tierlistInfo} />
			</tr>
		);
	}

	return (
		<QuickTooltip
			max
			tooltipContent={
				data.__related.pb ? (
					<MiniTable colSpan={99} headers={[`${reqUser.username}'s Score`]}>
						<tr>
							<ScoreCoreCells chart={data} game={game} score={data.__related.pb} />
						</tr>
					</MiniTable>
				) : undefined
			}
		>
			<div
				className={`${colourClass} bg-opacity-50 rounded p-2`}
				style={{ backgroundColor: colourCss ? ChangeOpacity(colourCss, 0.5) : undefined }}
			>
				<Link className="text-decoration-none" to={CreateChartLink(data)}>
					{data.__related.song.title}
				</Link>{" "}
				{FormatDifficultyShort(data)}
				<Divider className="my-2" />
				{tierlistInfo.value} ({tierlistInfo.text ?? "No Info"})
				{tierlistInfo.idvDiff && (
					<>
						<br />

						<div className="mt-1">
							<QuickTooltip tooltipContent="Individual Difference - The difficulty of this varies massively between people!">
								<span>
									<Icon type="balance-scale-left" />
								</span>
							</QuickTooltip>
						</div>
					</>
				)}
				<Muted>
					<Divider className="my-2" />
					<ReferToUser reqUser={reqUser} />{" "}
					{tierlistInfo.status === AchievedStatuses.NOT_PLAYED
						? "not played this chart."
						: tierlistInfo.score}
				</Muted>
			</div>
		</QuickTooltip>
	);
}

function TierlistInfoCell({
	tierlistInfo,
	colourCss,
}: {
	colourCss: string | undefined;
	tierlistInfo: TierlistInfo;
}) {
	let colour = colourCss;

	if (!colour) {
		if (tierlistInfo.status === AchievedStatuses.FAILED) {
			colour = COLOUR_SET.red;
		} else if (tierlistInfo.status === AchievedStatuses.NOT_PLAYED) {
			colour = COLOUR_SET.red;
		} else {
			colour = COLOUR_SET.green;
		}
	}

	return (
		<td
			style={{
				backgroundColor: colour ? ChangeOpacity(colour, 0.5) : undefined,
				width: "60px",
				minWidth: "60px",
				maxWidth: "60px",
			}}
		>
			{tierlistInfo.score ?? <Muted>NOT PLAYED</Muted>}
		</td>
	);
}

interface TierlistInfo {
	chart: FolderDataset[0];
	score: string | null;
	status: AchievedStatuses;
	value: number | null | undefined;
	text: string | null | undefined;
	idvDiff: boolean | null | undefined;
}

enum AchievedStatuses {
	NOT_PLAYED,
	FAILED,
	ACHIEVED,
	SCORE_BASED,
}

function FolderDatasetAchievedStatus(folderDataset: FolderDataset, game: V3Game, tierlist: string) {
	const tierlistInfo: Record<string, { score: string | null; status: AchievedStatuses }> = {};

	const fn = (GPT_CLIENT_IMPLEMENTATIONS[game].ratingSystems as GPTRatingSystem<V3Game>[]).find(
		(e) => e.name === tierlist,
	)?.achievementFn;

	for (const data of folderDataset) {
		let achieved: AchievedStatuses;
		let score: string | null = null;

		if (!data.__related.pb) {
			achieved = AchievedStatuses.NOT_PLAYED;
		} else if (fn) {
			const v = fn(data.__related.pb as any);

			achieved = v[1] ? AchievedStatuses.ACHIEVED : AchievedStatuses.FAILED;
			score = typeof v[0] === "number" ? v[0].toString() : v[0];
		} else {
			achieved = AchievedStatuses.SCORE_BASED;
		}

		tierlistInfo[data.chartID] = {
			status: achieved,
			score,
		};
	}

	return tierlistInfo;
}
