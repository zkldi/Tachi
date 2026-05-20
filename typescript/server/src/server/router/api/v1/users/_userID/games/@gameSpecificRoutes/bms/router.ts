import { GetPBOnChart } from "#lib/db-formats/pb";
import {
	CUSTOM_TACHI_BMS_TABLES,
	HandleBMSTableBodyRequest,
	HandleBMSTableHeaderRequest,
	HandleBMSTableHTMLRequest,
	type TachiBMSTable,
} from "#lib/game-specific/custom-bms-tables";
import { withGame, withGameAndReqData, withRequestedUserAndReqData } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { FindBMSChartOnHashInGame } from "#utils/queries/charts";
import { REQ_GetUser } from "#utils/req-tachi-data";
import { ExpectedErr } from "bliss";
import { type GamesForGroup, GameToGameGroup } from "tachi-common";

function resolveUserCustomBMSTableOrThrow(
	tableUrlName: string,
	game: GamesForGroup["bms"],
): TachiBMSTable {
	const customTable = CUSTOM_TACHI_BMS_TABLES.find((t) => t.urlName === tableUrlName);

	if (!customTable) {
		throw new ExpectedErr(404, `No such table with the ID '${tableUrlName}' exists.`);
	}

	if (customTable.game && customTable.game !== game) {
		throw new ExpectedErr(
			404,
			`The table '${tableUrlName}' exists, but is for ${customTable.game}, not ${game}.`,
		);
	}

	if (customTable.forSpecificUser !== true) {
		throw new ExpectedErr(
			404,
			`The table '${tableUrlName}' exists, but isn't user specific. You should be fetching this table from /api/v1/games instead of /api/v1/users/:userID.`,
		);
	}

	return customTable;
}

/**
 * Return some HTML for this custom table.
 *
 * @note Since this is the UGPT route, trying to fetch GPT custom tables
 * will result in a 404. This applies for all subsequent :tableUrlName routes.
 *
 * @name GET /api/v1/users/:userID/games/:game/custom-tables/:tableUrlName
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/custom-tables/:tableUrlName",
	withRequestedUserAndReqData,
	withGameAndReqData,
	({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveUserCustomBMSTableOrThrow(params.tableUrlName, game);
		HandleBMSTableHTMLRequest(customTable, req, res);
		return success("stub", {});
	},
);

/**
 * Return the header.json for this custom table.
 *
 * @name GET /api/v1/users/:userID/games/:game/custom-tables/:tableUrlName/header.json
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/custom-tables/:tableUrlName/header.json",
	withRequestedUserAndReqData,
	withGameAndReqData,
	async ({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveUserCustomBMSTableOrThrow(params.tableUrlName, game);
		await HandleBMSTableHeaderRequest(customTable, req, res);
		return success("stub", {});
	},
);

/**
 * Return the body.json for this custom table.
 *
 * @name GET /api/v1/users/:userID/games/:game/custom-tables/:tableUrlName/body.json
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/custom-tables/:tableUrlName/body.json",
	withRequestedUserAndReqData,
	withGameAndReqData,
	async ({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveUserCustomBMSTableOrThrow(params.tableUrlName, game);
		await HandleBMSTableBodyRequest(customTable, req, res);
		return success("stub", {});
	},
);

const MD5_CHECKSUM_LENGTH = "60b725f10c9c85c70d97880dfe8191b3".length;
const SHA256_CHECKSUM_LENGTH = "87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7"
	.length;

/**
 * Get this user's best chart on the given chart MD5 or SHA256.
 *
 * @name GET /api/v1/users/:userID/games/:game/best-score/:checksum
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/best-score/:checksum",
	withRequestedUserAndReqData,
	withGame,
	async ({ ctx, params, req }) => {
		const user = REQ_GetUser(req);

		const checksumRaw = params.checksum;
		if (!checksumRaw) {
			throw new ExpectedErr(400, "No checksum provided.");
		}

		const checksum = checksumRaw.toLowerCase();

		if (!/^[0-9a-f]+$/u.exec(checksum)) {
			throw new ExpectedErr(400, "Invalid checksum (Was not a MD5 or SHA256 checksum).");
		}

		if (checksum.length !== MD5_CHECKSUM_LENGTH && checksum.length !== SHA256_CHECKSUM_LENGTH) {
			throw new ExpectedErr(
				400,
				"Invalid checksum length (Was not a MD5 or SHA256 checksum).",
			);
		}

		const v3Game = ctx.game;

		if (GameToGameGroup(v3Game) !== "bms") {
			throw new ExpectedErr(404, `No BMS charts exist for ${v3Game}.`);
		}

		const chart = await FindBMSChartOnHashInGame(checksum, v3Game);

		if (!chart) {
			throw new ExpectedErr(404, "No chart found with the given checksum.");
		}

		const pb = await GetPBOnChart(user.id, chart.chartID);
		const description = pb ? "Best score found." : "Player has not played this chart.";

		return success(description, pb);
	},
);
