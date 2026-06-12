import { type GoalsOnChartReturn, type GoalsOnFolderReturn } from "#types/api-returns";
import {
	type ChartDocument,
	type GameGroup,
	type integer,
	type ScoreDocument,
	type SEEDS_SongDocument,
	type SessionScoreInfo,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

export function GetPBs(scoreInfo: SessionScoreInfo[]) {
	return scoreInfo.filter((e) => {
		if (e.isNewScore) {
			return true;
		}

		for (const v of Object.values(e.deltas)) {
			if (v >= 0) {
				return true;
			}
		}

		return false;
	});
}

export function CreateSongMap<G extends GameGroup = GameGroup>(
	songs: Array<SEEDS_SongDocument<G> | SongDocument<G>>,
) {
	const songMap = new Map<string, SongDocument<G>>();

	for (const song of songs) {
		songMap.set(song.id, song as SongDocument<G>);
	}

	return songMap;
}

export function CreateUserMap(users: UserDocument[]) {
	const userMap = new Map<integer, UserDocument>();

	for (const user of users) {
		userMap.set(user.id, user);
	}

	return userMap;
}

export function CreateGoalMap<G extends { goalID: string }>(goals: Array<G>) {
	const goalMap = new Map<string, G>();

	for (const goal of goals) {
		goalMap.set(goal.goalID, goal);
	}

	return goalMap;
}

export function CreateChartIDMap<T extends { chartID: string }>(arr: T[]): Map<string, T> {
	const map = new Map();

	for (const t of arr) {
		map.set(t.chartID, t);
	}

	return map;
}

export function CreateChartMap<TGame extends V3Game = V3Game>(charts: ChartDocument<TGame>[]) {
	const chartMap = new Map<string, ChartDocument<TGame>>();

	for (const chart of charts) {
		chartMap.set(chart.chartID, chart);
	}

	return chartMap;
}

export function CreateScoreIDMap<TGame extends V3Game = V3Game>(scores: ScoreDocument<TGame>[]) {
	const scoreMap = new Map<string, ScoreDocument<TGame>>();

	for (const score of scores) {
		scoreMap.set(score.scoreID, score);
	}

	return scoreMap;
}

export function CreateChartLink(chart: ChartDocument) {
	return `/games/${chart.game}/charts/${chart.chartID}`;
}

// stolen from server
export function GetGoalIDsFromQuest(quest: {
	questData: Array<{ goals: Array<{ goalID: string }> }>;
}) {
	// this sucks - maybe a nicer way to do this, because nested
	// maps are just ugly
	return quest.questData.map((e) => e.goals.map((e) => e.goalID)).flat(1);
}

export function CreateGoalSubDataset(
	data: GoalsOnChartReturn | GoalsOnFolderReturn,
	userMap: Map<integer, UserDocument>,
) {
	const dataset = [];
	const goalMap = CreateGoalMap(data.goals);

	for (const sub of data.goalSubs) {
		const goal = goalMap.get(sub.goalID);

		if (!goal) {
			console.warn(
				`No goal was sent for ${sub.userID}:${sub.goalID}, yet was a subscription?`,
			);
			continue;
		}

		const user = userMap.get(sub.userID);

		if (!user) {
			console.warn(
				`No user was set for ${sub.userID}:${sub.goalID}, yet was a subscription?`,
			);
			continue;
		}

		const parentQuests = data.quests.filter((q) =>
			GetGoalIDsFromQuest(q).includes(goal.goalID),
		);

		dataset.push({
			...sub,
			__related: {
				goal,
				user,
				parentQuests,
			},
		});
	}

	return dataset;
}
