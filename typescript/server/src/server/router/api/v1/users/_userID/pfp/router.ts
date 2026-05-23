import { ACTION_ChangePfp } from "#actions/change-pfp";
import { ACTION_DeletePfp } from "#actions/delete-pfp";
import { CDNRedirect } from "#lib/cdn/cdn";
import { GetProfilePictureURL } from "#lib/cdn/url-format";
import { ONE_MEGABYTE } from "#lib/constants/filesize";
import { log } from "#lib/log/log";
import { withAuthedAsUser, withPermission, withRequestedUser } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { RequirePermissions } from "#server/middleware/auth";
import { CreateMulterSingleUploadMiddleware } from "#server/middleware/multer-upload";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { REQ_GetTachiData } from "#utils/req-tachi-data";

import { GetUserFromParam, RequireAuthedAsUser } from "../middleware";

/**
 * Sets a profile picture.
 *
 * @param pfp - A JPG, PNG or GIF file less than 1mb.
 * @note although GIFs are supported, this functionality isn't documented on the site.
 * this is kind of an easter egg.
 *
 * @name PUT /api/v1/users/:userID/pfp
 */
API_V1_ROUTER.rawAdd(
	"PUT",
	"/users/:userID/pfp",
	GetUserFromParam,
	RequireAuthedAsUser,
	RequirePermissions("customise_profile"),
	CreateMulterSingleUploadMiddleware("pfp", ONE_MEGABYTE),
	async (req, res) => {
		const user = REQ_GetTachiData(req, "requestedUser");

		if (!req.file) {
			return res.status(400).json({
				success: false,
				description: `No file provided.`,
			});
		}

		const { contentHash } = await ACTION_ChangePfp(
			{
				acct: {
					id: user.id,
					username: user.username,
				},
				ip: req.ip,
			},
			{
				"!fileBuffer": req.file.buffer,
				fileMimetype: req.file.mimetype,
			},
		);

		if (req.session.tachi?.user) {
			req.session.tachi.user.customPfpLocation = contentHash;
		}

		return res.status(200).json({
			success: true,
			description: `Stored profile picture.`,
			body: {
				get: req.originalUrl,
			},
		});
	},
);

/**
 * Returns this user's profile picture. If the user does not have a custom profile picture,
 * return the default profile picture.
 *
 * @name GET /api/v1/users/:userID/pfp
 */
API_V1_ROUTER.add("GET /users/:userID/pfp", withRequestedUser, ({ ctx, res }) => {
	const { requestedUser: user } = ctx;

	log.debug(user, "User Info for /:userID/pfp request is ");

	// The redirect target is content-addressed (hash in path), so the CDN
	// object itself is immutable. Cache the userId→CDN-URL mapping for 1 hour
	// so browsers don't hit the API on every page load.
	res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

	if (!user.customPfpLocation) {
		res.setHeader("Content-Type", "image/png");
		CDNRedirect(res, "/users/default/pfp");
		return success("Redirected to default profile picture.", {});
	}

	CDNRedirect(res, GetProfilePictureURL(user.id, user.customPfpLocation));
	return success("Redirected to profile picture.", {});
});

/**
 * Deletes this user's profile picture, and go back to the default profile picture.
 *
 * @name DELETE /api/v1/users/:userID/pfp
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/pfp",
	withRequestedUser,
	withAuthedAsUser,
	withPermission("customise_profile"),
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_DeletePfp(
			{
				acct: {
					id: user.id,
					username: user.username,
				},
				ip: req.ip,
			},
			{},
		);

		if (req.session.tachi?.user) {
			req.session.tachi.user.customPfpLocation = null;
		}

		return success("Removed custom profile picture.", {});
	},
);
