import { type Database } from "sql.js";

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

const getDifficulty = (score: ArcaeaST3ScoreRow) => {
	switch (score.songDifficulty) {
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
			throw new Error(`Unknown difficulty ${score.songDifficulty}`);
	}
};

const getLamp = (score: ArcaeaST3ScoreRow) => {
	switch (score.clearType) {
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
			throw new Error(`Unknown clearType ${score.clearType}`);
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
	scores: unknown[];
}

export function convertArcaeaDB(db: Database): { result: ArcaeaBatchManual; warnings: [] } {
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

	const scores = [];

	for (const row of rows) {
		let judgements;
		if (row.missCount > 0 && getLamp(row) === "FULL RECALL") {
			judgements = {};
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
			difficulty: getDifficulty(row),
			score: row.score,
			lamp: getLamp(row),
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
}
