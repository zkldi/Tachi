import { SELECT_SESSION_CALENDAR, ToSessionCalendarDocument } from "#lib/db-formats/session";
import { withRequestedUser } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";

/**
 * Returns all sessions, FOR ALL GPTs
 * but with unnecessary properties removed so as to reduce
 * bandwidth. This is used for the calendar view in tachi-client, hence the name.
 *
 * @name GET /api/v1/users/:userID/sessions/calendar
 */
API_V1_ROUTER.add("GET /users/:userID/sessions/calendar", withRequestedUser, async ({ ctx }) => {
	const rows = await DB.selectFrom("session")
		.select(SELECT_SESSION_CALENDAR)
		.where("session.user_id", "=", ctx.requestedUser.id)
		.execute();

	const sessions = rows.map(ToSessionCalendarDocument);

	return success(`Found ${sessions.length} events.`, sessions);
});
