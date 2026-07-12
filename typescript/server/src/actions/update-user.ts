import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { DeleteUndefinedProps, IsNonEmptyString, StripUrl } from "#utils/misc";
import { ExpectedErr } from "bliss";

export const ACTION_UpdateUser = MakeAction("UPDATE_USER", async (taker, body) => {
	const updates = {
		about: body.about,
		status: body.status,
		sm_discord: body.discord,
		sm_twitter: body.twitter,
		sm_github: body.github,
		sm_steam: body.steam,
		sm_youtube: body.youtube,
		sm_twitch: body.twitch,
	};

	DeleteUndefinedProps(updates);

	if (Object.keys(updates).length === 0) {
		throw new ExpectedErr(400, "No arguments provided to update user.");
	}

	// Hack stuff for user experience.
	// In kt1, users would repeatedly mess up these fields.
	if (IsNonEmptyString(updates.sm_twitter)) {
		updates.sm_twitter = StripUrl("twitter.com/", updates.sm_twitter);
	}

	if (IsNonEmptyString(updates.sm_github)) {
		updates.sm_github = StripUrl("github.com/", updates.sm_github);
	}

	if (IsNonEmptyString(updates.sm_youtube)) {
		// youtube has THREE user urls lol
		updates.sm_youtube = StripUrl("youtube.com/user/", updates.sm_youtube);
		updates.sm_youtube = StripUrl("youtube.com/channel/", updates.sm_youtube);
		updates.sm_youtube = StripUrl("youtube.com/@", updates.sm_youtube);
	}

	if (IsNonEmptyString(updates.sm_twitch)) {
		updates.sm_twitch = StripUrl("twitch.tv/", updates.sm_twitch);
	}

	if (IsNonEmptyString(updates.sm_steam)) {
		updates.sm_steam = StripUrl("steamcommunity.com/id/", updates.sm_steam);
	}

	await DB.updateTable("account").set(updates).where("id", "=", taker.acct.id).execute();

	return {};
});
