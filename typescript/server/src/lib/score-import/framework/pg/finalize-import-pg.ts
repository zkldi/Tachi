import type { Kysely } from "kysely";
import type { Database } from "tachi-db";

import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	type ClassDelta,
	type GameGroup,
	type GoalImportInfo,
	type ImportTypes,
	type integer,
	type QuestImportInfo,
	type SessionInfoReturn,
	type V3Game,
} from "tachi-common";

type ImportErrRow = { message: string; type: string };

export interface FinalizeImportTiming {
	parseMs: number;
	importMs: number;
	importParseMs: number;
	sessionMs: number;
	pbMs: number;
	ugsMs: number;
	goalMs: number;
	questMs: number;
	totalMs: number;
}

/**
 * Commits staged scores and writes normalized import metadata + timing in one transaction.
 */
export async function finalizeImportToPostgres(
	db: Kysely<Database>,
	args: {
		classDeltas: Array<ClassDelta>;
		createdSessions: Array<SessionInfoReturn>;
		errors: Array<ImportErrRow>;
		gameGroup: GameGroup;
		games: Array<V3Game>;
		goalInfo: Array<GoalImportInfo>;
		importID: string;
		importType: ImportTypes;
		questInfo: Array<QuestImportInfo>;
		scoreCount: number;
		service: string;
		timeFinishedMs: number;
		timeStartedMs: number;
		timing: FinalizeImportTiming;
		userId: integer;
		userIntent: boolean;
	},
): Promise<void> {
	const {
		importID,
		gameGroup,
		importType,
		userIntent,
		service,
		timeStartedMs,
		timeFinishedMs,
		games,
		errors,
		classDeltas,
		createdSessions,
		goalInfo,
		questInfo,
		timing,
		scoreCount,
	} = args;

	const timeStarted = UnixMillisecondsToISO8601(timeStartedMs);
	const timeFinished = UnixMillisecondsToISO8601(timeFinishedMs);
	const tsNow = new Date().toISOString();

	await db
		.updateTable("import")
		.set({
			time_started: timeStarted,
			time_finished: timeFinished,
			game_group: gameGroup,
			import_type: importType,
			user_intent: userIntent,
			service,
			status: "completed",
		})
		.where("id", "=", importID)
		.execute();

	await db
		.updateTable("score")
		.set({ committed: true })
		.where("import_id", "=", importID)
		.where("committed", "=", false)
		.execute();

	await db.deleteFrom("import_game").where("id", "=", importID).execute();

	if (games.length > 0) {
		await db
			.insertInto("import_game")
			.values(games.map((game) => ({ id: importID, game })))
			.onConflict((oc) => oc.columns(["id", "game"]).doNothing())
			.execute();
	}

	await db.deleteFrom("import_error").where("import_id", "=", importID).execute();
	if (errors.length > 0) {
		await db
			.insertInto("import_error")
			.values(
				errors.map((err) => ({
					import_id: importID,
					type: err.type,
					message: err.message,
				})),
			)
			.onConflict((oc) => oc.column("row_id").doNothing())
			.execute();
	}

	await db.deleteFrom("import_class").where("import_id", "=", importID).execute();

	if (classDeltas.length > 0) {
		await db
			.insertInto("import_class")
			.values(
				classDeltas.map((d) => ({
					import_id: importID,
					game: d.game,
					set: d.set as string,
					prev: d.old,
					new: d.new ?? "",
				})),
			)
			.onConflict((oc) => oc.column("row_id").doNothing())
			.execute();
	}

	await db.deleteFrom("import_session").where("import_id", "=", importID).execute();

	if (createdSessions.length > 0) {
		await db
			.insertInto("import_session")
			.values(
				createdSessions.map((s) => ({
					import_id: importID,
					session_id: s.sessionID,
					type: s.type.toLowerCase() as "appended" | "created",
				})),
			)
			.onConflict((oc) => oc.columns(["import_id", "session_id"]).doNothing())
			.execute();
	}

	await db.deleteFrom("import_goal").where("import_id", "=", importID).execute();

	if (goalInfo.length > 0) {
		await db
			.insertInto("import_goal")
			.values(
				goalInfo.map((g) => ({
					import_id: importID,
					goal_id: g.goalID,
					prev_achieved: g.old.achieved,
					prev_out_of: g.old.outOf,
					prev_out_of_human: g.old.outOfHuman,
					prev_progress: g.old.progress,
					prev_progress_human: g.old.progressHuman,
					new_achieved: g.new.achieved,
					new_out_of: g.new.outOf,
					new_out_of_human: g.new.outOfHuman,
					new_progress: g.new.progress,
					new_progress_human: g.new.progressHuman,
				})),
			)
			.onConflict((oc) => oc.column("row_id").doNothing())
			.execute();
	}

	await db.deleteFrom("import_quest").where("import_id", "=", importID).execute();

	if (questInfo.length > 0) {
		await db
			.insertInto("import_quest")
			.values(
				questInfo.map((q) => ({
					import_id: importID,
					quest_id: q.questID,
					prev_achieved: q.old.achieved,
					prev_progress: q.old.progress,
					new_achieved: q.new.achieved,
					new_progress: q.new.progress,
				})),
			)
			.onConflict((oc) => oc.column("row_id").doNothing())
			.execute();
	}

	const n = Math.max(1, scoreCount);

	await db
		.insertInto("import_timing")
		.values({
			id: importID,
			timestamp: tsNow,
			import_secs_avg: timing.importMs / n,
			import_parse_secs_avg: timing.importParseMs / n,
			pb_secs_avg: timing.pbMs / n,
			session_secs_avg: timing.sessionMs / n,
			parse_secs: timing.parseMs,
			import_secs: timing.importMs,
			import_parse_secs: timing.importParseMs,
			session_secs: timing.sessionMs,
			pb_secs: timing.pbMs,
			ugs_secs: timing.ugsMs,
			goal_secs: timing.goalMs,
			quest_secs: timing.questMs,
			total_secs: timing.totalMs,
		})
		.onConflict((oc) => oc.column("id").doNothing())
		.execute();
}
