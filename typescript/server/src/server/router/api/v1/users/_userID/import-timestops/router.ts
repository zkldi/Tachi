import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import {
	DeleteImportTimestop,
	ListImportTimestops,
	SetImportTimestopManual,
} from "#lib/score-import/framework/common/timestop";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { ExpectedErr } from "bliss";
import { type APIImportTypes } from "tachi-common";
import { apiImportTypes } from "tachi-common/constants/import-types";

function assertApiImportType(importType: string): APIImportTypes {
	if (!apiImportTypes.includes(importType as APIImportTypes)) {
		throw new ExpectedErr(400, `Invalid import type: ${importType}`);
	}

	return importType as APIImportTypes;
}

/**
 * List API import timestop cursors for this user.
 *
 * @name GET /api/v1/users/:userID/import-timestops
 */
API_V1_ROUTER.add(
	"GET /users/:userID/import-timestops",
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const timestops = await ListImportTimestops(user.id);

		return success(`Returned ${timestops.length} import timestops.`, { timestops });
	},
);

/**
 * Reset an API import timestop cursor so the next import starts from scratch.
 *
 * @param importType - The API import type to reset.
 *
 * @name DELETE /api/v1/users/:userID/import-timestops
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/import-timestops",
	withRequestedUser,
	withSelf,
	async ({ input, ctx }) => {
		const { requestedUser: user } = ctx;
		const importType = assertApiImportType(input.importType);

		await DeleteImportTimestop(user.id, importType);

		return success(`Reset import timestop for ${importType}.`, {});
	},
);

/**
 * Set an API import timestop cursor to a specific timestamp.
 *
 * @param importType - The API import type to update.
 * @param lastScoreTime - Epoch milliseconds for the new cursor.
 *
 * @name PUT /api/v1/users/:userID/import-timestops
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/import-timestops",
	withRequestedUser,
	withSelf,
	async ({ input, ctx }) => {
		const { requestedUser: user } = ctx;
		const importType = assertApiImportType(input.importType);

		if (!Number.isFinite(input.lastScoreTime)) {
			throw new ExpectedErr(400, "lastScoreTime must be a finite number.");
		}

		await SetImportTimestopManual(user.id, importType, new Date(input.lastScoreTime));

		return success(`Updated import timestop for ${importType}.`, {});
	},
);
