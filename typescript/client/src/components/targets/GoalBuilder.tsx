/**
 * GoalBuilder — a focused, step-based UI for creating or updating a goal.
 *
 * Step 1 – Chart target: card-toggle buttons (Single / Multiple / Folder) with
 *           an AsyncSelect beneath the chosen type.
 * Step 2 – Criteria: pill-button metric selector + inline value picker.
 *
 * Live goal-name preview is fetched from the server with a 400 ms debounce.
 *
 * When `existingGoal` is provided the builder pre-fills from it and shows a
 * diff summary in the preview header.
 */

import AsyncSelect from "#components/util/AsyncSelect";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import { type SongChartsSearch } from "#types/api-returns";
import { type GameProps, type SetState } from "#types/react";
import { type RawQuestGoal } from "#types/tachi";
import { APIFetchV1 } from "#util/api";
import { clamp, UppercaseFirst } from "#util/misc";
import { StrSOV } from "#util/sorts";
import React, { useEffect, useRef, useState } from "react";
import { Badge, Button, Col, Form, InputGroup, Row } from "react-bootstrap";
import { type GroupBase, type OptionsOrGroups } from "react-select";
import {
	type ChartDocument,
	type FolderDocument,
	FormatChart,
	GetGameConfig,
	GetScoreMetricConf,
	GetScoreMetrics,
	type GoalDocument,
	type SongDocument,
} from "tachi-common";
import { type ConfEnumScoreMetric } from "tachi-common/types/metrics";

// ─── Public interface ─────────────────────────────────────────────────────────

interface GoalBuilderProps extends GameProps {
	/**
	 * Called when the user confirms the goal.
	 *
	 * Receives the `RawQuestGoal` so callers can either add-goal directly or
	 * attach a note for the quest-editor use-case.
	 */
	onCreate: (rawGoal: RawQuestGoal) => void;

	/** If set, shows a note input (useful when adding a goal inside a quest). */
	showNote?: boolean;

	/**
	 * When provided the builder pre-fills from this goal's `charts` and
	 * `criteria` so the user can modify and "update" it.
	 */
	existingGoal?: GoalDocument;

	/** Label for the confirm button. Defaults to "Add Goal". */
	confirmLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalBuilder({
	game,
	onCreate,
	showNote = false,
	existingGoal,
	confirmLabel = "Add Goal",
}: GoalBuilderProps) {
	const gameConfig = GetGameConfig(game);

	const defaultEnum = gameConfig.preferredDefaultEnum;
	const enumConf = GetScoreMetricConf(gameConfig, defaultEnum) as ConfEnumScoreMetric<string>;

	// ── State ──────────────────────────────────────────────────────────────────

	const [charts, setCharts] = useState<GoalDocument["charts"]>(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		existingGoal?.charts ?? ({ type: "single", data: null } as any),
	);

	const [criteria, setCriteria] = useState<GoalDocument["criteria"]>(
		existingGoal?.criteria ?? {
			mode: "single",
			key: defaultEnum,
			value: enumConf.values.indexOf(enumConf.minimumRelevantValue),
		},
	);

	const [note, setNote] = useState("");
	const [goalName, setGoalName] = useState(existingGoal?.name ?? "...");
	const [goalErr, setGoalErr] = useState<string | null>(null);

	// ── Sync: force single mode when chart type is single ─────────────────────

	const isFirstRender = useRef(true);

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}

		if (charts.type === "single") {
			setCriteria((prev) => ({ mode: "single", key: prev.key, value: prev.value }));
		}
	}, [charts.type]);

	// ── Live preview (debounced 400 ms) ───────────────────────────────────────

	useEffect(() => {
		if ("data" in charts && charts.data === null) {
			setGoalName("...");
			return;
		}

		const id = window.setTimeout(async () => {
			const res = await APIFetchV1<string>(`/games/${game}/targets/goals/format`, {
				method: "POST",
				body: JSON.stringify({ criteria, charts }),
				headers: { "Content-Type": "application/json" },
			});

			if (res.success) {
				setGoalName(res.body);
				setGoalErr(null);
			} else {
				const match = /^Invalid goal: (.*)/u.exec(res.description) as
					| [string, string]
					| null;

				if (match) {
					setGoalName("...");
					setGoalErr(match[1]);
				}
			}
		}, 400);

		return () => window.clearTimeout(id);
	}, [charts, criteria, game]);

	// ── Computed helpers ──────────────────────────────────────────────────────

	const isReady =
		goalName !== "..." &&
		!goalErr &&
		!("data" in charts && charts.data === null) &&
		!(criteria.mode === "absolute" && criteria.countNum <= 1);

	const isDiffMode = !!existingGoal;

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="goal-builder">
			{/* ── Preview header ─────────────────────────────────────────────── */}
			<div className="text-center mb-4">
				<p className="text-body-secondary small mb-1">
					{isDiffMode ? "Updating goal to:" : "Goal preview:"}
				</p>
				<h4 className={`display-6 mb-0 ${goalName === "..." ? "text-body-secondary" : ""}`}>
					{goalName}
				</h4>
				{isDiffMode && existingGoal.name !== goalName && goalName !== "..." && (
					<p className="text-body-secondary small mt-1">
						<s>{existingGoal.name}</s>
					</p>
				)}
				{goalErr && <p className="text-danger small mt-1">{goalErr}</p>}
			</div>

			<Divider />

			{/* ── Step 1: Chart target ───────────────────────────────────────── */}
			<h6 className="mb-3 fw-semibold">Step 1 — Chart Target</h6>
			<ChartTargetPicker charts={charts} game={game} onChange={setCharts} />

			<Divider />

			{/* ── Step 2: Criteria ──────────────────────────────────────────── */}
			<h6 className="mb-3 fw-semibold">Step 2 — Success Criteria</h6>
			<CriteriaPicker
				charts={charts}
				criteria={criteria}
				game={game}
				setCriteria={setCriteria}
			/>

			{/* ── Optional note ─────────────────────────────────────────────── */}
			{showNote && (
				<>
					<Divider />
					<InputGroup>
						<InputGroup.Text>Note (optional)</InputGroup.Text>
						<Form.Control
							onChange={(e) => setNote(e.target.value)}
							placeholder="Is this goal particularly noteworthy in this quest?"
							value={note}
						/>
					</InputGroup>
				</>
			)}

			<Divider />

			{/* ── Confirm ───────────────────────────────────────────────────── */}
			<div className="d-flex justify-content-center">
				<Button
					disabled={!isReady}
					onClick={async () => {
						const res = await APIFetchV1<string>(
							`/games/${game}/targets/goals/format`,
							{
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ criteria, charts }),
							},
							false,
							true,
						);

						if (res.success) {
							onCreate({
								note: note === "" ? undefined : note,
								goal: { name: res.body, charts, criteria },
							});
						}
					}}
					variant={isDiffMode ? "warning" : "primary"}
				>
					<Icon type={isDiffMode ? "pencil" : "plus"} /> {confirmLabel}
				</Button>
			</div>
		</div>
	);
}

// ─── ChartTargetPicker ────────────────────────────────────────────────────────

function ChartTargetPicker({
	charts,
	game,
	onChange,
}: {
	charts: GoalDocument["charts"];
	onChange: (charts: GoalDocument["charts"]) => void;
} & GameProps) {
	const [type, setType] = useState<GoalDocument["charts"]["type"]>(charts.type);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [data, setData] = useState<any>("data" in charts ? charts.data : null);
	const isFirstRender = useRef(true);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => onChange({ type, data }), [type, data]);

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}

		setData(null);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onChange({ type, data: null as any });
		// Intentionally only react to type changes to reset data on type switch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	const types: Array<{ icon: string; id: GoalDocument["charts"]["type"]; label: string }> = [
		{ icon: "music", id: "single", label: "Single Chart" },
		{ icon: "layer-group", id: "multi", label: "Multiple Charts" },
		{ icon: "folder-open", id: "folder", label: "Folder" },
	];

	return (
		<>
			{/* Card-toggle buttons */}
			<Row className="g-2 mb-3">
				{types.map((t) => (
					<Col key={t.id} xs={4}>
						<div
							className={`border rounded p-3 text-center cursor-pointer user-select-none ${
								type === t.id
									? "border-primary bg-primary bg-opacity-10 text-primary"
									: "border-secondary text-body-secondary"
							}`}
							onClick={() => setType(t.id)}
							style={{ cursor: "pointer" }}
						>
							<div className="mb-1">
								<Icon type={t.icon} />
							</div>
							<small className="fw-semibold">{t.label}</small>
						</div>
					</Col>
				))}
			</Row>

			{/* Async search */}
			{type === "folder" ? (
				<FolderSelect game={game} initialValue={data} onChange={setData} />
			) : type === "single" ? (
				<ChartSelect game={game} initialValue={data} onChange={setData} />
			) : (
				<ChartSelect game={game} initialValue={data} multi onChange={setData} />
			)}
		</>
	);
}

// ─── CriteriaPicker ───────────────────────────────────────────────────────────

function CriteriaPicker({
	criteria,
	charts,
	setCriteria,
	game,
}: {
	charts: GoalDocument["charts"];
	criteria: GoalDocument["criteria"];
	setCriteria: SetState<GoalDocument["criteria"]>;
} & GameProps) {
	const gameConfig = GetGameConfig(game);
	const availableMetrics = GetScoreMetrics(gameConfig, ["ENUM", "DECIMAL", "INTEGER"]);

	return (
		<>
			{/* Metric pills */}
			<div className="d-flex flex-wrap gap-2 mb-3">
				{availableMetrics.map((metricKey) => (
					<button
						className={`btn btn-sm ${
							criteria.key === metricKey ? "btn-primary" : "btn-outline-secondary"
						}`}
						key={metricKey}
						onClick={() => {
							const conf = GetScoreMetricConf(gameConfig, metricKey);
							const defaultValue =
								conf?.type === "ENUM"
									? conf.values.indexOf(conf.minimumRelevantValue)
									: 0;

							setCriteria({
								...criteria,
								key: metricKey,
								value: defaultValue,
							});
						}}
						type="button"
					>
						{UppercaseFirst(metricKey)}
					</button>
				))}
			</div>

			{/* Value row */}
			<div className="d-flex align-items-center flex-wrap gap-2 mb-2">
				<Badge bg="secondary" className="py-2 px-3">
					{UppercaseFirst(criteria.key)}
				</Badge>
				<span className="text-body-secondary">≥</span>
				<CriteriaValuePicker
					criteria={criteria}
					game={game}
					onChange={(value) => setCriteria({ ...criteria, value })}
				/>
			</div>

			{/* Mode picker (absolute / proportion) for multi/folder */}
			{charts.type !== "single" && (
				<>
					<Divider />
					<CriteriaModePicker
						charts={charts}
						criteria={criteria}
						game={game}
						onChange={(mode, countNum) => {
							if (mode === "single") {
								setCriteria({
									mode: "single",
									key: criteria.key,
									value: criteria.value,
								});
							} else {
								setCriteria({ ...criteria, countNum: countNum ?? 0, mode });
							}
						}}
					/>
				</>
			)}
		</>
	);
}

// ─── CriteriaValuePicker ─────────────────────────────────────────────────────

function CriteriaValuePicker({
	criteria,
	game,
	onChange,
}: {
	criteria: GoalDocument["criteria"];
	onChange: (value: number) => void;
} & GameProps) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, criteria.key);

	if (!conf) {
		return <span className="text-danger small">Unknown metric: {criteria.key}</span>;
	}

	switch (conf.type) {
		case "NULLABLE_GRAPH":
		case "GRAPH":
			return (
				<span className="text-body-secondary small">
					Cannot set goals for graph metrics.
				</span>
			);

		case "DECIMAL":
		case "INTEGER":
			return (
				<Form.Control
					min={0}
					onChange={(e) => onChange(Number(e.target.value))}
					style={{ width: "120px" }}
					type="number"
					value={criteria.value}
				/>
			);

		case "ENUM":
			return (
				<Form.Select
					onChange={(e) => onChange(Number(e.target.value))}
					style={{ width: "auto" }}
					value={criteria.value.toString()}
				>
					{conf.values
						.slice(conf.values.indexOf(conf.minimumRelevantValue))
						.map((label, i) => {
							const idx = i + conf.values.indexOf(conf.minimumRelevantValue);
							return (
								<option key={idx} value={idx}>
									{label}
								</option>
							);
						})}
				</Form.Select>
			);
	}
}

// ─── CriteriaModePicker ───────────────────────────────────────────────────────

function CriteriaModePicker({
	criteria,
	onChange,
	charts,
	game: _game,
}: {
	charts: GoalDocument["charts"];
	criteria: GoalDocument["criteria"];
	onChange: (mode: GoalDocument["criteria"]["mode"], countNum?: number) => void;
} & GameProps) {
	const [absCount, setAbsCount] = useState(criteria.mode === "absolute" ? criteria.countNum : 10);
	const [perCount, setPerCount] = useState(
		criteria.mode === "proportion" ? criteria.countNum * 100 : 10,
	);

	useEffect(() => {
		if (criteria.mode === "proportion") {
			onChange("proportion", perCount / 100);
		} else if (criteria.mode === "absolute") {
			onChange("absolute", absCount);
		}
		// onChange is intentionally excluded — it's a callback prop that changes every render
		// and including it would cause infinite loops. absCount/perCount drive the update.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [absCount, perCount]);

	if ("data" in charts && charts.data === null) {
		return null;
	}

	const pluralTarget = charts.type === "multi" ? "of these charts" : "charts in this folder";
	const anyTarget = charts.type === "multi" ? "any of these charts" : "any chart in this folder";

	return (
		<div className="d-flex flex-column gap-2">
			<Form.Check
				checked={criteria.mode === "single"}
				id="mode-single"
				label={`On ${anyTarget}`}
				onChange={() => onChange("single")}
				type="radio"
			/>
			<div className="d-flex align-items-center gap-2">
				<Form.Check
					checked={criteria.mode === "absolute"}
					id="mode-absolute"
					label="On"
					onChange={() => onChange("absolute", absCount)}
					type="radio"
				/>
				<Form.Control
					min={2}
					onChange={(e) => setAbsCount(Number(e.target.value))}
					style={{ width: "80px" }}
					type="number"
					value={absCount}
				/>
				<span>{pluralTarget}</span>
			</div>
			{charts.type !== "multi" && (
				<div className="d-flex align-items-center gap-2">
					<Form.Check
						checked={criteria.mode === "proportion"}
						id="mode-proportion"
						label="On"
						onChange={() => onChange("proportion", perCount / 100)}
						type="radio"
					/>
					<Form.Control
						max={100}
						min={0}
						onChange={(e) => setPerCount(clamp(Number(e.target.value), 0, 100))}
						style={{ width: "80px" }}
						type="number"
						value={perCount}
					/>
					<span>% of {pluralTarget}</span>
				</div>
			)}
		</div>
	);
}

// ─── FolderSelect ─────────────────────────────────────────────────────────────

function FolderSelect({
	game,
	onChange,
	initialValue,
}: { initialValue?: string | null; onChange: (data: string) => void } & GameProps) {
	let lastTimeout: number | null = null;

	const loadOptions = (
		input: string,
		cb: (options: OptionsOrGroups<unknown, GroupBase<unknown>>) => void,
	) => {
		if (lastTimeout !== null) {
			clearTimeout(lastTimeout);
		}

		lastTimeout = window.setTimeout(async () => {
			const res = await APIFetchV1<Array<FolderDocument>>(
				`/games/${game}/folders?search=${encodeURIComponent(input)}`,
			);

			if (!res.success) {
				throw new Error(res.description);
			}

			const options = res.body
				.map((e) => ({ value: e.folderID, label: e.title }))
				.sort(StrSOV((x) => x.label));

			cb(options);
		}, 300);
	};

	return (
		<AsyncSelect
			defaultValue={initialValue ? { value: initialValue, label: initialValue } : undefined}
			loadOptions={loadOptions}
			// @ts-expect-error react-select types are unhelpful here
			onChange={(data) => onChange(data.value)}
			placeholder="Search for a folder..."
		/>
	);
}

// ─── ChartSelect ─────────────────────────────────────────────────────────────

function ChartSelect({
	game,
	multi = false,
	onChange,
	initialValue,
}: {
	initialValue?: string | string[] | null;
	multi?: boolean;
	onChange: (data: string | string[]) => void;
} & GameProps) {
	let lastTimeout: number | null = null;

	const loadOptions = (
		input: string,
		cb: (options: OptionsOrGroups<unknown, GroupBase<unknown>>) => void,
	) => {
		if (lastTimeout !== null) {
			clearTimeout(lastTimeout);
		}

		lastTimeout = window.setTimeout(async () => {
			const [res, res2] = await Promise.all([
				APIFetchV1<SongChartsSearch>(
					`/games/${game}/charts?search=${encodeURIComponent(input)}`,
				),
				APIFetchV1<{
					charts: Record<string, Array<{ chart: ChartDocument; song: SongDocument }>>;
				}>(`/search/chart-hash?search=${encodeURIComponent(input)}`),
			]);

			if (!res.success || !res2.success) {
				throw new Error(res.description);
			}

			const hashCharts = res2.body.charts[game] ?? [];
			const options = [...res.body.charts, ...hashCharts.map((e) => e.chart)]
				.map((e) => ({ value: e.chartID, label: FormatChart(e) }))
				.sort(StrSOV((x) => x.label));

			cb(options);
		}, 300);
	};

	const defaultValue = initialValue
		? Array.isArray(initialValue)
			? initialValue.map((v) => ({ value: v, label: v }))
			: { value: initialValue, label: initialValue }
		: undefined;

	return (
		<AsyncSelect
			defaultValue={defaultValue}
			isMulti={multi}
			loadOptions={loadOptions}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			onChange={(data: any) =>
				onChange(
					Array.isArray(data) ? data.map((e: { value: string }) => e.value) : data.value,
				)
			}
			placeholder="Search for a chart..."
		/>
	);
}
