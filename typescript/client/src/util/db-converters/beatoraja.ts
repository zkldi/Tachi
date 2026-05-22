/**
 * Port of tachi-import-scripts/src-tauri/src/backend/beatoraja.rs
 *
 * Converts Beatoraja score.db + chart.db into Batch Manual documents
 * (one per gamemode: 7K, 14K) suitable for /ir/direct-manual/import.
 */

import { type Database } from "sql.js";

import { queryAll, queryOne } from "./sql-loader";

const SERVICE = "tachi-import-scripts";

interface BeatorajaScoreRow {
	sha256: string;
	clear: number;
	epg: number;
	egr: number;
	egd: number;
	ebd: number;
	epr: number;
	ems: number;
	lpg: number;
	lgr: number;
	lgd: number;
	lbd: number;
	lpr: number;
	lms: number;
	combo: number;
	minbp: number;
	random: number;
	date: number;
}

interface BeatorajaChartRow {
	title: string;
	subtitle: string;
	feature: number;
	mode: number;
}

export interface BeatorajaConvertWarning {
	message: string;
	level: "error" | "warn";
}

interface BMSBatchManual {
	meta: {
		game: "bms";
		playtype: "7K" | "14K";
		service: string;
		version: null;
	};
	scores: unknown[];
	classes: Record<string, never>;
}

export interface BeatorajaConvertResult {
	k7: BMSBatchManual | null;
	k14: BMSBatchManual | null;
	warnings: BeatorajaConvertWarning[];
}

// Chart feature bitflags (from beatoraja.rs)
const CHART_FEATURE_RANDOM = 0b100;

function parseLamp(clear: number): string | null {
	switch (clear) {
		case 0:
			return "NO PLAY";
		case 1:
			return "FAILED";
		case 2:
		case 3:
			return "ASSIST CLEAR";
		case 4:
			return "EASY CLEAR";
		case 5:
			return "CLEAR";
		case 6:
			return "HARD CLEAR";
		case 7:
			return "EX HARD CLEAR";
		case 8:
		case 9:
		case 10:
			return "FULL COMBO";
		default:
			return null;
	}
}

function parseRandom(random: number): string | null {
	switch (random) {
		case 0:
			return "NONRAN";
		case 1:
			return "MIRROR";
		case 2:
			return "RANDOM";
		case 3:
			return "R-RANDOM";
		case 4:
			return "S-RANDOM";
		default:
			// H-Ran, Spiral, etc. — unfair, skip
			return null;
	}
}

export function convertBeatorajaDb(scoreDb: Database, chartDb: Database): BeatorajaConvertResult {
	// mode = 0 means BMS (not PMS)
	const scoreRows = queryAll<BeatorajaScoreRow>(scoreDb, "SELECT * FROM score WHERE mode = 0");

	const scores7k: unknown[] = [];
	const scores14k: unknown[] = [];
	const warnings: BeatorajaConvertWarning[] = [];

	for (const score of scoreRows) {
		const chart = queryOne<BeatorajaChartRow>(
			chartDb,
			"SELECT title, subtitle, feature, mode FROM song WHERE sha256 = ?",
			[score.sha256],
		);

		if (!chart) {
			warnings.push({
				level: "warn",
				message: `Could not find a matching chart for sha256 ${score.sha256}. Skipping.`,
			});
			continue;
		}

		const name = `${chart.title} ${chart.subtitle}`.trim();

		// Skip charts with #RANDOM declarations — results are non-deterministic
		if (chart.feature & CHART_FEATURE_RANDOM) {
			continue;
		}

		if (chart.mode !== 7 && chart.mode !== 14) {
			// Unknown/unsupported gamemode — silently skip
			continue;
		}

		const playtype = chart.mode === 7 ? "7K" : "14K";

		const lamp = parseLamp(score.clear);
		if (lamp === null) {
			warnings.push({
				level: "warn",
				message: `Skipping score on "${name}" — unknown lamp value ${score.clear}.`,
			});
			continue;
		}

		let random: string | null = null;
		if (playtype === "7K") {
			random = parseRandom(score.random);
			if (random === null) {
				warnings.push({
					level: "warn",
					message: `Skipping score on "${name}" — invalid or unfair random option (${score.random}).`,
				});
				continue;
			}
		}

		// Beatoraja stores i32::MAX or negative as "no BP data"
		const bp = score.minbp === 2_147_483_647 || score.minbp < 0 ? null : score.minbp;

		const bmsScore = {
			identifier: score.sha256,
			matchType: "bmsChartHash",
			score: (score.lpg + score.epg) * 2 + score.egr + score.lgr,
			lamp,
			comment: null,
			timeAchieved: score.date * 1000,
			optional: {
				bp,
				fast: score.egr + score.egd,
				slow: score.lgr + score.lgd,
				maxCombo: score.combo,
				epg: score.epg,
				egr: score.egr,
				egd: score.egd,
				ebd: score.ebd,
				epr: score.epr,
				lpg: score.lpg,
				lgr: score.lgr,
				lgd: score.lgd,
				lbd: score.lbd,
				lpr: score.lpr,
			},
			scoreMeta: {
				random,
				inputDevice: null,
				client: "lr2oraja",
				gauge: null,
			},
			judgements: {
				pgreat: score.epg + score.lpg,
				great: score.egr + score.lgr,
				good: score.egd + score.lgd,
				bad: score.ebd + score.lbd,
				poor: score.epr + score.lpr + score.ems + score.lms,
			},
		};

		if (playtype === "7K") {
			scores7k.push(bmsScore);
		} else {
			scores14k.push(bmsScore);
		}
	}

	return {
		k7:
			scores7k.length > 0
				? {
						meta: { game: "bms", playtype: "7K", service: SERVICE, version: null },
						scores: scores7k,
						classes: {},
					}
				: null,
		k14:
			scores14k.length > 0
				? {
						meta: { game: "bms", playtype: "14K", service: SERVICE, version: null },
						scores: scores14k,
						classes: {},
					}
				: null,
		warnings,
	};
}
