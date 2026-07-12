import { ACTION_UpdateFervidexSettings } from "#actions/update-fervidex-settings";
import { SELECT_FER_SETTINGS, ToFervidexSettingsDocument } from "#lib/db-formats/fervidex-settings";
import { withKamaitachi, withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

/**
 * Retrieve your fervidex settings.
 *
 * @name GET /api/v1/users/:userID/integrations/fervidex/settings
 */
API_V1_ROUTER.add(
	"GET /users/:userID/integrations/fervidex/settings",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const row = await DB.selectFrom("svc_fer_settings")
			.select(SELECT_FER_SETTINGS)
			.where("user_id", "=", user.id)
			.executeTakeFirst();

		if (!row) {
			return success("Retrieved Fervidex settings.", {
				userID: user.id,
				cards: null,
				forceStaticImport: false,
			});
		}

		const cardRows = await DB.selectFrom("priv_svc_fer_card")
			.select(["priv_svc_fer_card.card_id"])
			.where("user_id", "=", user.id)
			.execute();

		const cards = cardRows.length > 0 ? cardRows.map((r) => r.card_id) : null;

		return success("Retrieved Fervidex settings.", ToFervidexSettingsDocument(row, cards));
	},
);

/**
 * Update your fervidex configuration.
 *
 * @param cards - An array of card IDs to use as a whitelist, or null to disable filtering.
 * @param forceStaticImport - Whether to force a static import on non-INF2 clients.
 *
 * @name PATCH /api/v1/users/:userID/integrations/fervidex/settings
 */
API_V1_ROUTER.add(
	"PATCH /users/:userID/integrations/fervidex/settings",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ input, ctx, req }) => {
		const hasCardsField = "cards" in input;
		const hasForceField = "forceStaticImport" in input;
		const hasBooleanForce = typeof input.forceStaticImport === "boolean";

		if (!hasCardsField && !hasForceField) {
			throw new ExpectedErr(400, "No modifications sent.");
		}

		if (hasForceField && !hasBooleanForce && !hasCardsField) {
			throw new ExpectedErr(400, "No modifications sent.");
		}

		const hasCards = input.cards !== undefined;
		const hasForceStaticImport = hasBooleanForce;

		if (input.cards !== null && input.cards !== undefined && input.cards.length > 6) {
			throw new ExpectedErr(400, "You cannot have more than 6 card filters at once.");
		}

		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		const result = await ACTION_UpdateFervidexSettings(taker, {
			cards: input.cards,
			forceStaticImport: hasForceStaticImport
				? (input.forceStaticImport as boolean)
				: undefined,
		});

		return success("Successfully updated settings.", result);
	},
);
