import type { CGServices } from "#lib/score-import/import-types/common/api-cg/types";

import { ACTION_DeleteCgCardInfo } from "#actions/delete-cg-card-info";
import { ACTION_UpdateCgCardInfo } from "#actions/update-cg-card-info";
import { SELECT_CG_CARD_INFO, ToCGCardInfo } from "#lib/db-formats/cg-card-info";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

const VALID_CG_TYPES = ["dev", "nag", "gan"] as const;

/** Validate and cast `:cgType` param, throwing a 404 for unsupported values. */
function resolveCGType(cgType: string | undefined): CGServices {
	if (cgType === undefined || !VALID_CG_TYPES.includes(cgType as CGServices)) {
		throw new ExpectedErr(404, `No such service 'cg/${cgType ?? ""}' is supported.`);
	}

	return cgType as CGServices;
}

/**
 * Retrieve this user's card info (cardID).
 *
 * @name GET /api/v1/users/:userID/integrations/cg/:cgType
 */
API_V1_ROUTER.add(
	"GET /users/:userID/integrations/cg/:cgType",
	withSelf,
	withRequestedUser,
	async ({ params, ctx }) => {
		const cgType = resolveCGType(params.cgType);
		const { requestedUser: user } = ctx;

		const row = await DB.selectFrom("priv_svc_cg_card_info")
			.select(SELECT_CG_CARD_INFO)
			.where("user_id", "=", user.id)
			.where("service", "=", cgType)
			.executeTakeFirst();

		if (!row) {
			return success("User has no card info set.", null);
		}

		return success("Found card info.", ToCGCardInfo(row));
	},
);

/**
 * Write new card details for this CG integration.
 *
 * @name PUT /api/v1/users/:userID/integrations/cg/:cgType
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/integrations/cg/:cgType",
	withSelf,
	withRequestedUser,
	async ({ input, params, ctx, req }) => {
		const cgType = resolveCGType(params.cgType);
		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_UpdateCgCardInfo(taker, {
			service: cgType,
			cardID: input.cardID,
			pin: input.pin,
		});

		return success("Updated cardID and pin.", {});
	},
);

/**
 * Unset this user's card details for this CG integration.
 *
 * @name DELETE /api/v1/users/:userID/integrations/cg/:cgType
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/integrations/cg/:cgType",
	withSelf,
	withRequestedUser,
	async ({ params, ctx, req }) => {
		const cgType = resolveCGType(params.cgType);
		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_DeleteCgCardInfo(taker, { service: cgType });

		return success("Deleted stored card info.", {});
	},
);
