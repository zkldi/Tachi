import DB from "#services/pg/db";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Selection } from "kysely";
import { type SessionDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_SESSION_DOCUMENT = [
	"session.id",
	"session.user_id",
	"session.game",
	"session.name",
	"session.description",
	"session.time_inserted",
	"session.time_started",
	"session.time_ended",
	"session.calculated_data",
	"session.highlight",
] as const;

export function ToSessionDocument(
	row: Selection<Database, "session", (typeof SELECT_SESSION_DOCUMENT)[number]>,
	scoreIDs: Array<string>,
): SessionDocument {
	const calculatedData =
		typeof row.calculated_data === "string"
			? (JSON.parse(row.calculated_data) as SessionDocument["calculatedData"])
			: (row.calculated_data as SessionDocument["calculatedData"]);

	return {
		userID: row.user_id,
		sessionID: row.id,
		scoreIDs,
		name: row.name,
		desc: row.description,
		game: row.game,
		timeInserted: ISO8601ToUnixMilliseconds(row.time_inserted),
		timeStarted: ISO8601ToUnixMilliseconds(row.time_started),
		timeEnded: ISO8601ToUnixMilliseconds(row.time_ended),
		calculatedData,
		highlight: row.highlight,
	};
}

export async function LoadSessionDocumentById(
	sessionID: string,
): Promise<SessionDocument | undefined> {
	const row = await DB.selectFrom("session")
		.select(SELECT_SESSION_DOCUMENT)
		.where("id", "=", sessionID)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	const scores = await DB.selectFrom("score")
		.select("id")
		.where("session_id", "=", sessionID)
		.execute();

	return ToSessionDocument(
		row,
		scores.map((s) => s.id),
	);
}

export const SELECT_SESSION_CALENDAR = [
	"session.id",
	"session.name",
	"session.description",
	"session.highlight",
	"session.time_started",
	"session.time_ended",
	"session.game",
] as const;

export type SessionCalendarDocument = Pick<
	SessionDocument,
	"desc" | "game" | "highlight" | "name" | "sessionID" | "timeEnded" | "timeStarted"
>;

export function ToSessionCalendarDocument(
	row: Selection<Database, "session", (typeof SELECT_SESSION_CALENDAR)[number]>,
): SessionCalendarDocument {
	return {
		sessionID: row.id,
		name: row.name,
		desc: row.description,
		highlight: row.highlight,
		timeStarted: ISO8601ToUnixMilliseconds(row.time_started),
		timeEnded: ISO8601ToUnixMilliseconds(row.time_ended),
		game: row.game,
	};
}
