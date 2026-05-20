import {
	CUSTOM_TACHI_BMS_TABLES,
	HandleBMSTableBodyRequest,
	HandleBMSTableHeaderRequest,
	HandleBMSTableHTMLRequest,
	type TachiBMSTable,
} from "#lib/game-specific/custom-bms-tables";
import { withGame, withGameAndReqData } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { FindBMSSieglindeRatedCharts } from "#utils/queries/charts";
import { ExpectedErr } from "bliss";
import { type GamesForGroup, GameToGameGroup } from "tachi-common";

function resolveGamesCustomBMSTableOrThrow(
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

	if (customTable.forSpecificUser === true) {
		throw new ExpectedErr(
			404,
			`The table '${tableUrlName}' exists, but is user-specific. You should be fetching this table from /api/v1/users/:userID instead of /api/v1/games.`,
		);
	}

	return customTable;
}

/**
 * List all custom BMS tables this instance of Tachi is emitting.
 *
 * @name GET /api/v1/games/:game/custom-tables
 */
API_V1_ROUTER.add("GET /games/:game/custom-tables", withGame, ({ ctx }) => {
	const tables: Array<{
		description: string;
		forSpecificUser: boolean;
		symbol: string;
		tableName: string;
		urlName: string;
	}> = [];

	const game = ctx.game as GamesForGroup["bms"];

	if (GameToGameGroup(game) !== "bms") {
		throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
	}

	for (const table of CUSTOM_TACHI_BMS_TABLES.filter((e) => e.game === game || e.game === null)) {
		tables.push({
			description: table.description,
			forSpecificUser: table.forSpecificUser === true,
			symbol: table.symbol,
			tableName: table.tableName,
			urlName: table.urlName,
		});
	}

	return success(`Found ${tables.length} custom table(s).`, tables);
});

/**
 * Return some HTML for this custom table.
 *
 * @note Since this is the GPT route, trying to fetch user specific custom tables
 * will result in a 404. This applies for all subsequent :tableUrlName routes.
 *
 * @name GET /api/v1/games/:game/custom-tables/:tableUrlName
 */
API_V1_ROUTER.add(
	"GET /games/:game/custom-tables/:tableUrlName",
	withGameAndReqData,
	({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveGamesCustomBMSTableOrThrow(params.tableUrlName, game);
		HandleBMSTableHTMLRequest(customTable, req, res);
		return success("stub", {});
	},
);

/**
 * Return the header.json for this custom table.
 *
 * @name GET /api/v1/games/:game/custom-tables/:tableUrlName/header.json
 */
API_V1_ROUTER.add(
	"GET /games/:game/custom-tables/:tableUrlName/header.json",
	withGameAndReqData,
	async ({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveGamesCustomBMSTableOrThrow(params.tableUrlName, game);
		await HandleBMSTableHeaderRequest(customTable, req, res);
		return success("stub", {});
	},
);

/**
 * Return the body.json for this custom table.
 *
 * @name GET /api/v1/games/:game/custom-tables/:tableUrlName/body.json
 */
API_V1_ROUTER.add(
	"GET /games/:game/custom-tables/:tableUrlName/body.json",
	withGameAndReqData,
	async ({ ctx, params, req, res }) => {
		const game = ctx.game as GamesForGroup["bms"];

		if (GameToGameGroup(game) !== "bms") {
			throw new ExpectedErr(404, `No custom tables exist for ${game}.`);
		}

		const customTable = resolveGamesCustomBMSTableOrThrow(params.tableUrlName, game);
		await HandleBMSTableBodyRequest(customTable, req, res);
		return success("stub", {});
	},
);

/**
 * Return *all* the charts that have defined sieglinde values for this game.
 *
 * @name GET /api/v1/games/:game/sieglinde-charts
 */
API_V1_ROUTER.add("GET /games/:game/sieglinde-charts", withGame, async ({ ctx }) => {
	const game = ctx.game as GamesForGroup["bms"];

	if (GameToGameGroup(game) !== "bms") {
		throw new ExpectedErr(404, `No sieglinde charts exist for ${game}.`);
	}

	const { charts, songs } = await FindBMSSieglindeRatedCharts(game);

	return success(`Found ${charts.length} chart(s).`, { songs, charts });
});
