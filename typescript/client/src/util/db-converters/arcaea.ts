import { type Database } from "sql.js";
import { type BatchManualScore } from "tachi-common";

import { queryAll } from "./sql-loader";

interface ArcaeaST3ScoreRow {
	songId: string;
	songDifficulty: number;
	score: number;
	shinyPerfectCount: number;
	perfectCount: number;
	nearCount: number;
	missCount: number;
	date: number;
	clearType: number;
}

interface ArcaeaYurisakiCSVRow {
	songId: string;
	songDifficulty: number;
	score: number;
	// constant: number;
	// potential: number;
	// ls: number;
	// shinyPerfectCount: number;
	perfectCount: number;
	nearCount: number;
	missCount: number;
	clearType: number;
	timestamp: number;
	// dateTime: string;
}

const getDifficulty = (songDifficulty: number) => {
	switch (songDifficulty) {
		case 0:
			return "Past";
		case 1:
			return "Present";
		case 2:
			return "Future";
		case 3:
			return "Beyond";
		case 4:
			return "Eternal";
		default:
			throw new Error(`Unknown difficulty ${songDifficulty}`);
	}
};

const getLamp = (clearType: number) => {
	switch (clearType) {
		case 0:
			return "LOST";
		case 1:
			return "CLEAR";
		case 2:
			return "FULL RECALL";
		case 3:
			return "PURE MEMORY";
		case 4:
			return "EASY CLEAR";
		case 5:
			return "HARD CLEAR";
		default:
			throw new Error(`Unknown clearType ${clearType}`);
	}
};

const normalizeTimestamp = (timestamp: number) => {
	if (timestamp < 10000) {
		return undefined;
	}
	const digitCount = timestamp.toString().length;
	return timestamp * 10 ** (13 - digitCount);
};

export interface ArcaeaBatchManual {
	meta: {
		game: "arcaea";
		service: string;
	};
	scores: BatchManualScore<"arcaea">[];
}

export const convertArcaeaDB = (db: Database): { result: ArcaeaBatchManual; warnings: [] } => {
	const rows = queryAll<ArcaeaST3ScoreRow>(
		db,
		`SELECT
			scores.songId,
			scores.songDifficulty,
			scores.score,
			scores.shinyPerfectCount,
			scores.perfectCount,
			scores.nearCount,
			scores.missCount,
			scores.date,
			cleartypes.clearType
		FROM scores
		JOIN cleartypes ON
			scores.songId = cleartypes.songId
			AND scores.songDifficulty = cleartypes.songDifficulty`,
	);

	const scores: BatchManualScore<"arcaea">[] = [];

	for (const row of rows) {
		let judgements;
		if (row.missCount > 0 && getLamp(row.clearType) === "FULL RECALL") {
			judgements = undefined;
		} else {
			judgements = {
				pure: row.perfectCount,
				far: row.nearCount,
				lost: row.missCount,
			};
		}
		scores.push({
			identifier: row.songId,
			matchType: "inGameStrID",
			difficulty: getDifficulty(row.songDifficulty),
			score: row.score,
			lamp: getLamp(row.clearType),
			timeAchieved: normalizeTimestamp(row.date),
			optional: {},
			scoreMeta: {},
			judgements,
		});
	}

	return {
		result: {
			meta: { game: "arcaea", service: "Arcaea-ST3" },
			scores,
		},
		warnings: [],
	};
};

const parseYurisakiCSVRow = (row: string): ArcaeaYurisakiCSVRow => {
	const matches = (row.match(/,/gu) ?? []).length;
	if (matches !== 12) {
		throw new Error(`Invalid CSV: expected 13 fields per row; got ${matches + 1}`);
	}

	const [
		songId,
		songDifficulty,
		score,
		_constant,
		_potential,
		_ls,
		_shinyPerfectCount,
		perfectCount,
		nearCount,
		missCount,
		clearType,
		timestamp,
		_dateTime,
	] = row.split(",");

	const number = (str: string) => {
		const rv = Number(str);
		if (!Number.isFinite(rv)) {
			throw new Error(`Invalid number ${str}`);
		}
		return rv;
	};

	return {
		songId,
		songDifficulty: number(songDifficulty),
		score: number(score),
		perfectCount: number(perfectCount),
		nearCount: number(nearCount),
		missCount: number(missCount),
		clearType: number(clearType),
		timestamp: number(timestamp),
	};
};

export const convertYurisakiCSV = (csv: string) => {
	const scores: BatchManualScore<"arcaea">[] = [];
	for (const row of csv.trim().split("\n").slice(1)) {
		const sc = parseYurisakiCSVRow(row);
		const lamp = getLamp(sc.clearType);

		let judgements;
		if (sc.missCount > 0 && lamp === "FULL RECALL") {
			judgements = undefined;
		} else {
			judgements = {
				pure: sc.perfectCount,
				far: sc.nearCount,
				lost: sc.missCount,
			};
		}

		scores.push({
			identifier: sc.songId,
			matchType: "inGameStrID",
			difficulty: getDifficulty(sc.songDifficulty),
			score: sc.score,
			lamp,
			timeAchieved: sc.timestamp,
			optional: {},
			scoreMeta: {},
			judgements,
		});
	}

	return {
		result: {
			meta: { game: "arcaea", service: "Yurisaki" },
			scores,
		},
		warnings: [],
	};
};
