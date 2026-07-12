import { LoadFolderDocumentsByIds } from "#lib/db-formats/folders";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import {
	type GoalDocument,
	type GoalSubscriptionDocument,
	type QuestDocument,
	type QuestSubscriptionDocument,
} from "tachi-common";

import { type GoalRow, type GoalSubWithGoalGameRow } from "./goal";
import { type QuestRow, type QuestSubWithQuestGameRow } from "./quest";

/**
 * Enriches folder-type goals with `charts.folderSlug` for API consumers (navigation).
 * `charts.data` remains the internal folder id.
 */
export async function AttachFolderSlugsToGoals(goals: Array<GoalDocument>): Promise<void> {
	const ids: string[] = [];

	for (const g of goals) {
		if (g.charts.type === "folder") {
			ids.push(g.charts.data);
		}
	}

	if (ids.length === 0) {
		return;
	}

	const map = await LoadFolderDocumentsByIds(ids);

	for (const g of goals) {
		if (g.charts.type === "folder") {
			const folder = map.get(g.charts.data);

			if (folder) {
				g.charts.folderSlug = folder.slug;
			}
		}
	}
}

export function ToGoalDocument(row: GoalRow): GoalDocument {
	return {
		goalID: row.id,
		game: row.game,
		name: row.name,
		charts: row.charts as GoalDocument["charts"],
		criteria: row.criteria as GoalDocument["criteria"],
	} as GoalDocument;
}

export function ToGoalSubscriptionDocument(row: GoalSubWithGoalGameRow): GoalSubscriptionDocument {
	const base = {
		game: row.goal_game,
		goalID: row.goal_id,
		userID: row.user_id,
		lastInteraction: row.last_interaction
			? ISO8601ToUnixMilliseconds(row.last_interaction)
			: null,
		outOf: row.out_of,
		outOfHuman: row.out_of_human,
		progress: row.progress,
		progressHuman: row.progress_human,
		wasAssignedStandalone: row.was_assigned_standalone,
		wasInstantlyAchieved: row.was_instantly_achieved,
	};

	if (!row.achieved) {
		return { ...base, achieved: false, timeAchieved: null };
	}

	return {
		...base,
		achieved: true,
		timeAchieved: row.time_achieved ? ISO8601ToUnixMilliseconds(row.time_achieved) : 0,
	};
}

export function ToQuestDocument(row: QuestRow): QuestDocument {
	return {
		questID: row.id,
		game: row.game,
		name: row.name,
		desc: row.description,
		questData: row.quest_data as QuestDocument["questData"],
	};
}

export function ToQuestSubscriptionDocument(
	row: QuestSubWithQuestGameRow,
): QuestSubscriptionDocument {
	const base = {
		game: row.quest_game,
		questID: row.quest_id,
		userID: row.user_id,
		progress: row.progress,
		lastInteraction: row.last_interaction
			? ISO8601ToUnixMilliseconds(row.last_interaction)
			: null,
		wasInstantlyAchieved: row.was_instantly_achieved,
	};

	if (!row.achieved) {
		return { ...base, achieved: false, timeAchieved: null };
	}

	return {
		...base,
		achieved: true,
		timeAchieved: row.time_achieved ? ISO8601ToUnixMilliseconds(row.time_achieved) : 0,
	};
}
