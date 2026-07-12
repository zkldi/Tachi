import { type ActivityReturn, type RecordActivityReturn } from "#types/api-returns";
import {
	type ClumpedActivity,
	type ClumpedActivityGoalAchievement,
	type ClumpedActivityScores,
} from "#types/tachi";

import { ONE_HOUR } from "./constants/time";
import { CreateChartMap, CreateGoalMap, CreateSongMap } from "./data";
import { CreateQuestMap } from "./misc";
import { NumericSOV } from "./sorts";

const SORT_ACTIVITY = NumericSOV((x: ClumpedActivity[0]) => {
	switch (x.type) {
		case "SESSION":
			return x.timeStarted;
		case "SCORES":
			return x.scores[0]?.timeAchieved ?? -Infinity;
		case "CLASS_ACHIEVEMENT":
			return x.timeAchieved;
		case "GOAL_ACHIEVEMENTS":
			return x.goals[0]?.timeAchieved ?? -Infinity;
		case "QUEST_ACHIEVEMENT":
			return x.sub.timeAchieved ?? -Infinity;
	}
}, true);

/**
 * Given recent activity data, clump it together so it's easier to work with,
 * by joining repeat-highlighted scores from the same user.
 *
 * This also supports multiple games, i.e. from /users/:userID/activity.
 */
export function ClumpActivity(data: ActivityReturn | RecordActivityReturn): ClumpedActivity {
	if (!("songs" in data)) {
		const act = [];
		for (const activity of Object.values(data)) {
			act.push(...ClumpActivity(activity));
		}

		return act.sort(SORT_ACTIVITY);
	}

	const songMap = CreateSongMap(data.songs);
	const chartMap = CreateChartMap(data.charts);

	const clumped: ClumpedActivity = [];

	let clump: ClumpedActivityScores["scores"] = [];
	let curUserID: number | null = null;
	let lastTime: number | null = null;

	for (const score of data.recentlyHighlightedScores
		.slice(0)
		.sort(NumericSOV((x) => x.timeAchieved ?? -Infinity, true))) {
		const song = songMap.get(score.songID);
		const chart = chartMap.get(score.chartID);

		if (!song || !chart) {
			console.warn(`Failed to resolve song or chart ${score.songID}, ${chart?.chartID}.`);
			continue;
		}

		if (
			(curUserID !== score.userID && curUserID !== null) ||
			(lastTime !== null && lastTime - (score.timeAchieved ?? 0) > ONE_HOUR * 8)
		) {
			clumped.push({ type: "SCORES", scores: clump });

			clump = [];
		}

		curUserID = score.userID;
		lastTime = score.timeAchieved;

		clump.push({
			...score,
			__related: {
				song,
				chart,
			},
		});
	}

	if (clump.length !== 0) {
		clumped.push({ type: "SCORES", scores: clump });
	}

	for (const session of data.recentSessions) {
		clumped.push({
			type: "SESSION",
			...session,
		});
	}

	for (const ach of data.achievedClasses) {
		clumped.push({
			type: "CLASS_ACHIEVEMENT",
			...ach,
		});
	}

	const goalMap = CreateGoalMap(data.goals);

	let goalClump: ClumpedActivityGoalAchievement["goals"] = [];
	// reset last clumps. I realise this is super copypasta, but we'll live.
	curUserID = null;
	lastTime = null;

	for (const sub of data.goalSubs
		.slice(0)
		.sort(NumericSOV((x) => x.timeAchieved ?? -Infinity, true))) {
		const goal = goalMap.get(sub.goalID);

		if (!goal) {
			console.warn(`Failed to resolve goal ${sub.goalID}. Skipping.`);
			continue;
		}

		if (
			(curUserID !== sub.userID && curUserID !== null) ||
			(lastTime !== null && lastTime - (sub.timeAchieved ?? 0) > ONE_HOUR * 8)
		) {
			if (curUserID !== null) {
				clumped.push({ type: "GOAL_ACHIEVEMENTS", userID: curUserID, goals: goalClump });
			}

			goalClump = [];
		}

		curUserID = sub.userID;
		lastTime = sub.timeAchieved;

		goalClump.push({
			...sub,
			__related: {
				goal,
			},
		});
	}

	if (goalClump.length !== 0) {
		clumped.push({ type: "GOAL_ACHIEVEMENTS", userID: goalClump[0].userID, goals: goalClump });
	}

	const questMap = CreateQuestMap(data.quests);

	for (const sub of data.questSubs) {
		const quest = questMap.get(sub.questID);

		if (!quest) {
			console.warn(
				`Couldn't find parent quest for recently-achieved-sub '${sub.questID}. Skipping.'`,
			);
			continue;
		}

		clumped.push({
			type: "QUEST_ACHIEVEMENT",
			userID: sub.userID,
			sub,
			quest,
		});
	}

	return clumped.sort(SORT_ACTIVITY);
}

export function GetUsers(data: ActivityReturn | RecordActivityReturn) {
	if ("users" in data) {
		return data.users;
	}

	return Object.values(data)
		.map((e) => e.users)
		.flat();
}
