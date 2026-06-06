import type { RequestHandler } from "express";

import DB from "#services/pg/db";
import { sql } from "kysely";

export const UpdateLastSeen: RequestHandler = (req, res, next) => {
	res.once("finish", () => {
		if (req.session?.tachi?.user.id === undefined) {
			return;
		}

		if (req.session.tachi.settings.preferences.invisible) {
			return;
		}

		// fire, but we have no reason to await it.
		void DB.updateTable("account")
			.set({
				last_seen: sql`NOW()`,
			})
			.where("id", "=", req.session.tachi.user.id)
			.execute();
	});

	next();
};
