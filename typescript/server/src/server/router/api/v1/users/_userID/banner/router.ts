import { ACTION_ChangeBanner } from "#actions/change-banner";
import { ACTION_DeleteBanner } from "#actions/delete-banner";
import { CDNRedirect } from "#lib/cdn/cdn";
import { GetProfileBannerURL } from "#lib/cdn/url-format";
import { ONE_MEGABYTE } from "#lib/constants/filesize";
import { withAuthedAsUser, withPermission, withRequestedUser } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { RequirePermissions } from "#server/middleware/auth";
import { CreateMulterSingleUploadMiddleware } from "#server/middleware/multer-upload";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { REQ_GetTachiData } from "#utils/req-tachi-data";

import { GetUserFromParam, RequireAuthedAsUser } from "../middleware";

/**
 * Sets a profile banner.
 *
 * @param banner - A JPG, PNG or GIF file less than 1mb.
 * @note although GIFs are supported, this functionality isn't documented on the site.
 * this is kind of an easter egg.
 *
 * @name PUT /api/v1/users/:userID/banner
 */
API_V1_ROUTER.rawAdd(
	"PUT",
	"/users/:userID/banner",
	GetUserFromParam,
	RequireAuthedAsUser,
	RequirePermissions("customise_profile"),
	CreateMulterSingleUploadMiddleware("banner", ONE_MEGABYTE),
	async (req, res) => {
		const user = REQ_GetTachiData(req, "requestedUser");

		if (!req.file) {
			return res.status(400).json({
				success: false,
				description: `No file provided.`,
			});
		}

		const { contentHash } = await ACTION_ChangeBanner(
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
			req.session.tachi.user.customBannerLocation = contentHash;
		}

		return res.status(200).json({
			success: true,
			description: `Stored profile banner.`,
			body: {
				get: req.originalUrl,
			},
		});
	},
);

/**
 * Returns this user's profile banner. If the user does not have a custom profile banner,
 * return the default profile banner.
 *
 * @name GET /api/v1/users/:userID/banner
 */
API_V1_ROUTER.add("GET /users/:userID/banner", withRequestedUser, ({ ctx, res }) => {
	const { requestedUser: user } = ctx;

	if (!user.customBannerLocation) {
		res.setHeader("Content-Type", "image/png");
		CDNRedirect(res, "/users/default/banner");
		return success("Redirected to default profile banner.", {});
	}

	// express sniffs whether this is a png or jpg **and** browsers dont care either.
	CDNRedirect(res, GetProfileBannerURL(user.id, user.customBannerLocation));
	return success("Redirected to profile banner.", {});
});

/**
 * Deletes this user's profile banner, and go back to the default profile banner.
 *
 * @name DELETE /api/v1/users/:userID/banner
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/banner",
	withRequestedUser,
	withAuthedAsUser,
	withPermission("customise_profile"),
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_DeleteBanner(
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
			req.session.tachi.user.customBannerLocation = null;
		}

		return success("Removed custom profile banner.", {});
	},
);
