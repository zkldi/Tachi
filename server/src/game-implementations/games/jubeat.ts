import { GoalFmtScore, GoalOutOfFmtScore, GradeGoalFormatter } from "./_common";
import db from "external/mongo/db";
import { CreatePBMergeFor } from "game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "game-implementations/utils/session-calc";
import { p } from "prudence";
import { Jubility } from "rg-stats";
import { FmtNum, GetGrade, JUBEAT_GBOUNDARIES } from "tachi-common";
import { IsNullish } from "utils/misc";
import type { GPTServerImplementation } from "game-implementations/types";
import type { Game, PBScoreDocument, Playtype, Versions, integer } from "tachi-common";

async function GetBestJubilityOnSongs(
	songIDs: Array<integer>,
	userID: integer,
	game: Game,
	playtype: Playtype,
	limit: integer
): Promise<Array<PBScoreDocument>> {
	const r: Array<{ doc: PBScoreDocument }> = await db["personal-bests"].aggregate([
		{
			$match: {
				game,
				playtype,
				userID,
				songID: { $in: songIDs },
			},
		},
		{
			// we need to do stuff dependent on the chart difficulty,
			// so we need the chart difficulty
			$lookup: {
				from: "charts-jubeat",
				localField: "chartID",
				foreignField: "chartID",
				as: "chart",
			},
		},
		{
			// "chart" is an array unless we unwind it.
			$unwind: {
				path: "$chart",
			},
		},
		{
			// sort on jubility (so we get the best score)
			$sort: {
				[`calculatedData.jubility`]: -1,
			},
		},
		{
			$group: {
				_id: {
					songID: "$songID",

					// Jubility is unique upon songID + difficulty. However, you
					// cannot have a PB on both a HARD BSC and a BSC counted for
					// jubility. This query is awkward. Sorry!
					difficulty: {
						$switch: {
							branches: [
								{
									case: { $in: ["$chart.difficulty", ["HARD BSC", "BSC"]] },
									then: "BSC",
								},
								{
									case: { $in: ["$chart.difficulty", ["HARD ADV", "ADV"]] },
									then: "ADV",
								},
								{
									case: { $in: ["$chart.difficulty", ["HARD EXT", "EXT"]] },
									then: "EXT",
								},
							],
						},
					},
				},
				doc: { $first: "$$ROOT" },
			},
		},

		// for some godforsaken reason you have to sort twice. after a grouping
		// the sort order becomes nondeterministic
		{
			$sort: {
				[`doc.calculatedData.jubility`]: -1,
			},
		},
		{
			$limit: limit,
		},
	]);

	return r.map((e) => e.doc);
}

const CURRENT_JUBEAT_HOT_VERSION: Versions["jubeat:Single"] = "beyond";

export async function GetPBsForJubility(userID: integer) {
	const hotSongs = await db.songs.jubeat.find(
		{ "data.displayVersion": CURRENT_JUBEAT_HOT_VERSION },
		{ projection: { id: 1 } }
	);

	const hotSongIDs = hotSongs.map((e) => e.id);

	const coldSongs = await db.songs.jubeat.find(
		{ "data.displayVersion": { $ne: CURRENT_JUBEAT_HOT_VERSION } },
		{ projection: { id: 1 } }
	);

	const coldSongIDs = coldSongs.map((e) => e.id);

	const [bestHotScores, bestScores] = await Promise.all([
		GetBestJubilityOnSongs(hotSongIDs, userID, "jubeat", "Single", 30),
		GetBestJubilityOnSongs(coldSongIDs, userID, "jubeat", "Single", 30),
	]);

	return { bestHotScores, bestScores };
}

async function CalculateJubility(game: Game, playtype: Playtype, userID: integer): Promise<number> {
	const { bestHotScores, bestScores } = await GetPBsForJubility(userID);

	let jubility = 0;

	jubility = jubility + bestHotScores.reduce((a, e) => a + (e.calculatedData.jubility ?? 0), 0);
	jubility = jubility + bestScores.reduce((a, e) => a + (e.calculatedData.jubility ?? 0), 0);

	return jubility;
}

export const JUBEAT_IMPL: GPTServerImplementation<"jubeat:Single"> = {
	chartSpecificValidators: {
		musicRate: (rate, chart) => {
			switch (chart.difficulty) {
				case "BSC":
				case "ADV":
				case "EXT":
					return p.isBetween(0, 100)(rate);

				case "HARD BSC":
				case "HARD ADV":
				case "HARD EXT":
					return p.isBetween(0, 120)(rate);
			}
		},
	},
	derivers: {
		grade: ({ score }) => GetGrade(JUBEAT_GBOUNDARIES, score),
	},
	scoreCalcs: {
		jubility: (scoreData, chart) =>
			Jubility.calculate(scoreData.score, scoreData.musicRate, chart.levelNum),
	},
	sessionCalcs: { jubility: SessionAvgBest10For("jubility") },
	profileCalcs: {
		jubility: CalculateJubility,
		naiveJubility: ProfileSumBestN("jubility", 60),
	},
	classDerivers: {
		colour: (ratings) => {
			const jubility = ratings.jubility;

			if (IsNullish(jubility)) {
				return null;
			}

			if (jubility >= 9500) {
				return "GOLD";
			} else if (jubility >= 8500) {
				return "ORANGE";
			} else if (jubility >= 7000) {
				return "PINK";
			} else if (jubility >= 5500) {
				return "PURPLE";
			} else if (jubility >= 4000) {
				return "VIOLET";
			} else if (jubility >= 2500) {
				return "BLUE";
			} else if (jubility >= 1500) {
				return "LIGHT_BLUE";
			} else if (jubility >= 750) {
				return "GREEN";
			} else if (jubility >= 250) {
				return "YELLOW_GREEN";
			}

			return "BLACK";
		},
	},
	goalCriteriaFormatters: {
		musicRate: (v) => `Get a music rate of ${v.toFixed(1)}% on`,
		score: GoalFmtScore,
	},
	goalProgressFormatters: {
		score: (pb) => FmtNum(pb.scoreData.score),
		musicRate: (pb) => `${pb.scoreData.musicRate.toFixed(1)}%`,
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				JUBEAT_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				JUBEAT_GBOUNDARIES[gradeIndex]!.name
			),
	},
	goalOutOfFormatters: {
		musicRate: (v) => `${v.toFixed(1)}%`,
		score: GoalOutOfFmtScore,
	},

	// musicRate is the default prop
	// but we want the user's best score to count aswell.
	pbMergeFunctions: [
		CreatePBMergeFor("largest", "enumIndexes.lamp", "Best Lamp", (base, score) => {
			base.scoreData.lamp = score.scoreData.lamp;
		}),
		CreatePBMergeFor("largest", "score", "Best Score", (base, score) => {
			base.scoreData.score = score.scoreData.score;
			base.scoreData.grade = score.scoreData.grade;
		}),
	],
	defaultMergeRefName: "Best Music Rate",
	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp === "EXCELLENT" && s.scoreData.score !== 1_000_000) {
				return `An EXCELLENT lamp must be accompanied with a score of 1 million.`;
			}

			if (s.scoreData.lamp !== "EXCELLENT" && s.scoreData.score === 1_000_000) {
				return `A score of 1 million must be accompanied with an EXCELLENT lamp.`;
			}
		},
		(s) => {
			let { good, great, miss, poor } = s.scoreData.judgements;

			great ??= 0;
			good ??= 0;
			poor ??= 0;
			miss ??= 0;

			if (s.scoreData.lamp === "EXCELLENT") {
				if (good + great + miss + poor > 0) {
					return "An EXCELLENT lamp can't have any non-perfect judgements.";
				}
			}

			if (s.scoreData.lamp === "FULL COMBO") {
				if (miss > 0) {
					return "A FULL COMBO cannot have any misses.";
				}
			}
		},
		(s) => {
			if (s.scoreData.score < 700_000 && s.scoreData.lamp !== "FAILED") {
				return "A score of <700k must be a fail.";
			}

			if (s.scoreData.score >= 700_000 && s.scoreData.lamp === "FAILED") {
				return "A score >=700k must be a clear.";
			}
		},
	],
};
