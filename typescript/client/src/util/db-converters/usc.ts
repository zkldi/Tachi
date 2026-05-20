/**
 * Port of tachi-import-scripts/src-tauri/src/backend/usc.rs
 *
 * Converts an unnamed_sdvx_clone (USC) maps.db into a Batch Manual document
 * suitable for submission to /ir/direct-manual/import.
 */

import { type Database } from "sql.js";

import { queryAll, queryOne } from "./sql-loader";

const SERVICE = "tachi-import-scripts";

const MIN_DB_VERSION = 19;
const MAX_DB_VERSION = 20;

interface USCScoreRow {
	score: number;
	crit: number;
	near: number;
	miss: number;
	gauge: number;
	timestamp: number;
	chart_hash: string;
	window_perfect: number;
	window_good: number;
	window_hold: number;
	window_miss: number;
	window_slam: number;
	gauge_type: number;
	auto_flags: number;
	mirror: boolean | number;
	random: boolean | number;
	early: number | null;
	late: number | null;
	combo: number | null;
	title: string;
	diff_shortname: string;
}

const DEFAULT_WINDOWS = { perfect: 46, good: 150, hold: 150, miss: 300, slam: 84 };
const LEGACY_WINDOWS = { perfect: 46, good: 92, hold: 138, miss: 250, slam: 84 };
const BUGGED_WINDOWS = { perfect: 46, good: 92, hold: 138, miss: 300, slam: 84 };

type HitWindows = typeof DEFAULT_WINDOWS;

function windowsEqual(a: HitWindows, b: HitWindows): boolean {
	return (
		a.perfect === b.perfect &&
		a.good === b.good &&
		a.hold === b.hold &&
		a.miss === b.miss &&
		a.slam === b.slam
	);
}

export interface USCConvertWarning {
	message: string;
	level: "error" | "warn";
}

function checkHitWindows(windows: HitWindows): { ok: boolean; warning?: USCConvertWarning } {
	if (windowsEqual(windows, DEFAULT_WINDOWS) || windowsEqual(windows, LEGACY_WINDOWS)) {
		return { ok: true };
	}
	if (windowsEqual(windows, BUGGED_WINDOWS)) {
		return {
			ok: true,
			warning: {
				level: "warn",
				message:
					"Score detected with bugged hit windows. A game update caused the new hit windows to partially apply. You should go into settings and reset your hit windows.",
			},
		};
	}
	return { ok: false };
}

function getLamp(score: USCScoreRow): string {
	if (score.score === 10_000_000) {
		return "PERFECT ULTIMATE CHAIN";
	}
	if (score.miss === 0) {
		return "ULTIMATE CHAIN";
	}
	if (score.gauge_type === 1) {
		return score.gauge > 0 ? "EXCESSIVE CLEAR" : "FAILED";
	}
	return score.gauge > 0.7 ? "CLEAR" : "FAILED";
}

function getNoteMod(mirror: boolean, random: boolean): string {
	if (mirror && random) {
		return "MIR-RAN";
	}
	if (mirror) {
		return "MIRROR";
	}
	if (random) {
		return "RANDOM";
	}
	return "NORMAL";
}

export interface USCBatchManual {
	meta: {
		game: "usc";
		playtype: "Controller" | "Keyboard";
		service: string;
		version: null;
	};
	scores: unknown[];
	classes: Record<string, never>;
}

export function convertUSCDb(
	db: Database,
	playtype: "Controller" | "Keyboard",
): { result: USCBatchManual; warnings: USCConvertWarning[] } {
	const versionRow = queryOne<{ version: number }>(db, "SELECT version FROM Database");
	if (!versionRow) {
		throw new Error("Could not read version from Database table.");
	}

	const version = versionRow.version;

	if (version < MIN_DB_VERSION) {
		throw new Error(
			`Your maps.db version is ${version}, which is below the minimum of ${MIN_DB_VERSION}. Update your game.`,
		);
	}
	if (version > MAX_DB_VERSION) {
		throw new Error(
			`Your maps.db version is ${version}, which is above the maximum supported version (${MAX_DB_VERSION}). Please report this so the tool can be updated.`,
		);
	}

	const rows = queryAll<USCScoreRow>(
		db,
		"SELECT * FROM Scores LEFT JOIN Charts ON Scores.chart_hash = Charts.hash",
	);

	const scores = [];
	const warnings: USCConvertWarning[] = [];

	for (const row of rows) {
		if (row.auto_flags !== 0) {
			continue;
		}

		const windows: HitWindows = {
			perfect: row.window_perfect,
			good: row.window_good,
			hold: row.window_hold,
			miss: row.window_miss,
			slam: row.window_slam,
		};

		const { ok, warning } = checkHitWindows(windows);
		if (warning) {
			warnings.push(warning);
		}
		if (!ok) {
			warnings.push({
				level: "error",
				message: `Skipping score on "${row.title} [${row.diff_shortname}]" — non-standard hit windows detected.`,
			});
			continue;
		}

		const mirror = Boolean(row.mirror);
		const random = Boolean(row.random);

		let gaugeMod: string;
		if (row.gauge_type === 0) {
			gaugeMod = "NORMAL";
		} else if (row.gauge_type === 1) {
			gaugeMod = "HARD";
		} else {
			warnings.push({
				level: "warn",
				message: `Skipping score on "${row.title} [${row.diff_shortname}]" — unknown gauge type ${row.gauge_type}.`,
			});
			continue;
		}

		scores.push({
			identifier: row.chart_hash,
			matchType: "uscChartHash",
			score: row.score,
			lamp: getLamp(row),
			comment: null,
			timeAchieved: row.timestamp * 1000,
			optional: {
				fast: row.early,
				slow: row.late,
				maxCombo: row.combo,
				gauge: row.gauge * 100,
			},
			scoreMeta: {
				noteMod: getNoteMod(mirror, random),
				gaugeMod,
			},
			judgements: {
				critical: row.crit,
				near: row.near,
				miss: row.miss,
			},
		});
	}

	return {
		result: {
			meta: { game: "usc", playtype, service: SERVICE, version: null },
			scores,
			classes: {},
		},
		warnings,
	};
}
