/**
 * Port of tachi-import-scripts/src-tauri/src/backend/lr2.rs
 *
 * Converts LR2 score.db + chart.db into Batch Manual documents
 * (one per gamemode: 7K, 14K) suitable for /ir/direct-manual/import.
 */

import { type Database } from "sql.js";

import { queryAll, queryOne } from "./sql-loader";

const SERVICE = "tachi-import-scripts";

interface LR2ScoreRow {
	hash: string;
	clear: number;
	perfect: number;
	great: number;
	good: number;
	bad: number;
	poor: number;
	maxcombo: number;
	minbp: number;
	op_best: number;
}

interface LR2ChartRow {
	title: string;
	subtitle: string | null;
	mode: number | null;
}

export interface LR2ConvertWarning {
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

export interface LR2ConvertResult {
	k7: BMSBatchManual | null;
	k14: BMSBatchManual | null;
	warnings: LR2ConvertWarning[];
}

function parseLamp(clear: number, name: string): string | null {
	switch (clear) {
		case 0:
			return "NO PLAY";
		case 1:
			return "FAILED";
		case 2:
			return "EASY CLEAR";
		case 3:
			return "CLEAR";
		case 4:
			return "HARD CLEAR";
		case 5:
			return "FULL COMBO";
		default:
			return null;
	}
}

/**
 * LR2 encodes the random option in the top digit of op_best.
 * 0 = NONRAN, 1 = MIRROR, 2 = RANDOM, 3 = S-RANDOM
 */
function parseRandom(opBest: number): string | null {
	if (opBest > 100) {
		return null;
	}
	const tenths = Math.floor(opBest / 10);
	switch (tenths) {
		case 0:
			return "NONRAN";
		case 1:
			return "MIRROR";
		case 2:
			return "RANDOM";
		case 3:
			return "S-RANDOM";
		default:
			return null;
	}
}

export function convertLR2Db(scoreDb: Database, chartDb: Database): LR2ConvertResult {
	const scoreRows = queryAll<LR2ScoreRow>(scoreDb, "SELECT * FROM score WHERE complete = 1");

	const scores7k: unknown[] = [];
	const scores14k: unknown[] = [];
	const warnings: LR2ConvertWarning[] = [];

	for (const score of scoreRows) {
		// MD5 hashes are 32 hex characters — skip anything that doesn't look like one
		if (score.hash.length !== 32) {
			continue;
		}

		const chart = queryOne<LR2ChartRow>(
			chartDb,
			"SELECT title, subtitle, mode FROM song WHERE hash = ?",
			[score.hash],
		);

		if (!chart) {
			warnings.push({
				level: "warn",
				message: `Could not find a matching chart for score hash ${score.hash}. Skipping.`,
			});
			continue;
		}

		const name = `${chart.title} ${chart.subtitle ?? ""}`.trim();

		if (chart.mode !== 7 && chart.mode !== 14) {
			// Unknown/unsupported gamemode — silently skip
			continue;
		}

		const playtype = chart.mode === 7 ? "7K" : "14K";

		if (score.minbp < 0) {
			// Likely autoscratch — skip
			warnings.push({
				level: "warn",
				message: `Skipping score on "${name}" — negative BP (${score.minbp}), probably autoscratch.`,
			});
			continue;
		}

		const lamp = parseLamp(score.clear, name);
		if (lamp === null) {
			warnings.push({
				level: "warn",
				message: `Skipping score on "${name}" — unknown lamp value ${score.clear}.`,
			});
			continue;
		}

		let random: string | null = null;
		if (playtype === "7K") {
			random = parseRandom(score.op_best);
			if (random === null) {
				warnings.push({
					level: "warn",
					message: `Skipping score on "${name}" — unknown random option ${score.op_best}.`,
				});
				continue;
			}
		}

		const bmsScore = {
			identifier: score.hash,
			matchType: "bmsChartHash",
			score: score.perfect * 2 + score.great,
			lamp,
			comment: null,
			timeAchieved: null,
			optional: {
				bp: score.minbp,
				maxCombo: score.maxcombo,
				fast: null,
				slow: null,
			},
			scoreMeta: {
				random,
				inputDevice: null,
				client: "LR2",
				gauge: null,
			},
			judgements: {
				pgreat: score.perfect,
				great: score.great,
				good: score.good,
				bad: score.bad,
				poor: score.poor,
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
