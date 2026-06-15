import { type GameImplementation } from "#game-implementations/types";
import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { Potential } from "rg-stats";
import { ARCAEA_GBOUNDARIES, GetGrade } from "tachi-common";

export const ARCAEA_IMPL: GameImplementation<"arcaea"> = {
	chartSpecificValidators: {
		score: (score, chart) => {
			if (score < 0) {
				return `Score must be non-negative. Got ${score}`;
			}

			if (chart.data.notecount && score > 10_000_000 + chart.data.notecount) {
				return `Score cannot exceed ${10_000_000 + chart.data.notecount} for this chart.`;
			}

			return true;
		},
	},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(ARCAEA_GBOUNDARIES, scoreData.score),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		potential: chart.levelNum > 0 ? Potential.calculate(scoreData.score, chart.levelNum) : 0,
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		naivePotential: SessionAvgBest10For("potential")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		naivePotential: await ProfileAvgBestN("potential", 30)(game, userID),
	}),
	classDerivers: (ratings) => {
		const potential = ratings.naivePotential;

		if (IsNullish(potential)) {
			return { badge: null };
		}

		if (potential >= 13.0) {
			return { badge: "THREE_STARS" };
		} else if (potential >= 12.5) {
			return { badge: "TWO_STARS" };
		} else if (potential >= 12.0) {
			return { badge: "ONE_STAR" };
		} else if (potential >= 11.0) {
			return { badge: "RED" };
		} else if (potential >= 10.0) {
			return { badge: "PURPLE" };
		} else if (potential >= 7.0) {
			return { badge: "ASH_PURPLE" };
		} else if (potential >= 3.5) {
			return { badge: "GREEN" };
		}

		return { badge: "BLUE" };
	},
	pbMergeFunctions: [
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "lamp" },
			"Best Lamp",
			(base, score) => {
				base.scoreData.lamp = score.scoreData.lamp;
			},
		),
	],
	defaultMergeRefName: "Best Score",
	chartDataRelevantFields: ["levelNum"],
	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp === "PURE MEMORY" && s.scoreData.score < 10_000_000) {
				return `PURE MEMORY scores must have a score larger than 10 million. Got ${s.scoreData.score} instead.`;
			}

			// This doesn't go both ways. Due to how Arcaea scoring works, you can technically
			// achieve a score of 10 million without a PM, if the chart's notecount is high enough.
			//
			// For example, if a chart has 2237 notes, 2236 shiny PUREs + 1 FAR gives a score of
			// exactly 10 million (2236.5 * 10_000_000 / 2237 + 2236 = 10_000_000).
		},
		(s) => {
			// 1 FAR is half the value of 1 PURE.
			// The minimum score for a FULL RECALL is an all-FAR FULL RECALL, or
			// 10_000_000 / 2 = 5_000_000.
			if (s.scoreData.lamp === "FULL RECALL" && s.scoreData.score < 5_000_000) {
				return `FULL RECALL scores must have a score larger than 5 million. Got ${s.scoreData.score} instead.`;
			}
		},
		(s) => {
			const { far, lost } = s.scoreData.judgements;

			if (s.scoreData.lamp === "PURE MEMORY" && (lost ?? 0) + (far ?? 0) > 0) {
				return "Cannot have a PURE MEMORY with any fars or losts.";
			} else if (s.scoreData.lamp === "FULL RECALL" && (lost ?? 0) > 0) {
				return "Cannot have a FULL RECALL with non-zero lost count.";
			}
		},
		(s) => {
			const { pure, far, lost } = s.scoreData.judgements;

			if (
				!IsNullish(pure) &&
				(far ?? 0) + (lost ?? 0) === 0 &&
				s.scoreData.lamp === "PURE MEMORY"
			) {
				const shinyPure = s.scoreData.score - 10_000_000;
				if (shinyPure > pure) {
					return `Impossible PURE MEMORY. Got ${s.scoreData.score} with ${pure} pures.`;
				}
			}
		},
		(s, c) => {
			const { pure, far, lost } = s.scoreData.judgements;

			const total = (pure ?? 0) + (far ?? 0) + (lost ?? 0);
			if (total > 0 && c.data.notecount !== undefined && total > c.data.notecount) {
				return `Too many judgements: received ${total} in total but the chart's note count is ${c.data.notecount}.`;
			}
		},
	],
};
