import { type Selection } from "kysely";
import { type Database } from "tachi-db";

export const SELECT_GOAL = [
	"goal.id",
	"goal.game",
	"goal.name",
	"goal.charts",
	"goal.criteria",
] as const;

export const SELECT_GOAL_SUB = [
	"goal_sub.goal_id",
	"goal_sub.user_id",
	"goal_sub.last_interaction",
	"goal_sub.progress",
	"goal_sub.progress_human",
	"goal_sub.out_of",
	"goal_sub.out_of_human",
	"goal_sub.achieved",
	"goal_sub.time_achieved",
	"goal_sub.was_instantly_achieved",
	"goal_sub.was_assigned_standalone",
] as const;

/** `goal_sub` joined with `goal` for `goal.game` as `goal_game`. */
export const SELECT_GOAL_SUB_WITH_GOAL_GAME = [
	...SELECT_GOAL_SUB,
	"goal.game as goal_game",
] as const;

export type GoalRow = Selection<Database, "goal", (typeof SELECT_GOAL)[number]>;
export type GoalSubRow = Selection<Database, "goal_sub", (typeof SELECT_GOAL_SUB)[number]>;
export type GoalSubWithGoalGameRow = Selection<
	Database,
	"goal" | "goal_sub",
	(typeof SELECT_GOAL_SUB_WITH_GOAL_GAME)[number]
>;
