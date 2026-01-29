import db from "external/mongo/db";
import type { Migration } from "utils/types";

const migration: Migration = {
	id: "maimaidx-fix-lamps",
	up: async () => {
		await db.scores.update(
			{
				game: "maimaidx",
				"scoreData.lamp": "FAILED",
				"scoreData.percent": { $gte: 80 },
			},
			{
				$set: {
					"scoreData.lamp": "CLEAR",
				},
			},
			{ multi: true }
		);
		await db.scores.update(
			{
				game: "maimaidx",
				"scoreData.lamp": "CLEAR",
				"scoreData.percent": { $lt: 80 },
			},
			{
				$set: {
					"scoreData.lamp": "FAILED",
				},
			},
			{ multi: true }
		);
	},
	down: () => {
		throw new Error(`Reverting this change is not possible.`);
	},
};

export default migration;
