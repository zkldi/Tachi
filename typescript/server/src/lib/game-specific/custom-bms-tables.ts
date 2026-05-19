import type { BMSTableHead, RawBMSTableEntry } from "bms-table-loader";
import type { Request, Response } from "express-serve-static-core";

import { log } from "#lib/log/log";
import { GetRivalUsers } from "#lib/rivals/rivals";
import { ServerConfig, TachiConfig } from "#lib/setup/config";
import { GetRelevantSongsAndCharts } from "#utils/db";
import {
	GetFolderChartsAndSongs,
	GetFolderNamesInOrder,
	GetFoldersFromTable,
	GetTableForIDGuaranteed,
} from "#utils/folder";
import { GetRecentUGScores } from "#utils/queries/scores";
import { REQ_GetGame, REQ_GetUser } from "#utils/req-tachi-data";
import path from "path";
import {
	type ChartDocument,
	CreateSongMap,
	type FolderDocument,
	type GamesForGroup,
	type integer,
	type SongDocument,
	type TableDocument,
} from "tachi-common";

// Instead of just supporting existing tables, Tachi should also be able
// to emit its own, custom BMS tables. These may be dynamic.

function AppendAndConvertChartsToBMSBody(
	body: Array<RawBMSTableEntry>,
	charts: Array<ChartDocument<GamesForGroup["bms"]>>,
	songMap: Map<string, SongDocument>,
	level: string,
) {
	for (const chart of charts) {
		const song = songMap.get(chart.song.id);

		// if we've got metadata to add...
		if (song) {
			body.push({
				level,
				title: song.title,
				artist: song.artist,
				md5: chart.data.hashMD5,
			});
		} else {
			log.warn(`BMS Chart md5=${chart.data.hashMD5} has no parent song.`);
			body.push({
				level,
				md5: chart.data.hashMD5,
			});
		}
	}
}

/**
 * Convert a table in Tachi into a bms header.json and body.json.
 */
export async function TachiTableToBMSTableJSON(
	table: TableDocument,
): Promise<Array<RawBMSTableEntry>> {
	const body: Array<RawBMSTableEntry> = [];

	const folders = await GetFoldersFromTable(table);

	// we have to iterate over these folders in the order the table document says
	// to
	// as bms tables are somewhat sensitive to being placed in the correct order.
	const folderMap = new Map<string, FolderDocument>();

	for (const folder of folders) {
		folderMap.set(folder.slug, folder);
	}

	for (const folderSlug of table.folders) {
		const folder = folderMap.get(folderSlug);

		if (!folder) {
			log.warn(
				`Table '${table.title}' refers to folder '${folderSlug}', yet no such folder exists in the db?`,
			);
			continue;
		}

		// note: we have to do this in sync so that 'response' is in the correct
		// order.
		// eslint-disable-next-line no-await-in-loop
		const data = await GetFolderChartsAndSongs(folder);
		const charts = data.charts as Array<ChartDocument<GamesForGroup["bms"]>>;
		const songMap = CreateSongMap(data.songs);

		AppendAndConvertChartsToBMSBody(body, charts, songMap, folder.title);
	}

	return body;
}

export type TachiBMSTable = {
	description: string;
	// is for all playtypes.

	game: GamesForGroup["bms"] | null; // what game is this for? If null, this table is for all bms games
	symbol: string; // what symbol should this table have?
	tableName: string; // what should it be called in-game?
	urlName: string; // what do we call this in the url?
} & (
	| {
			forSpecificUser: true; // if this table is user-dependent
			getBody: (
				userID: integer,
				game: GamesForGroup["bms"],
			) => Promise<Array<RawBMSTableEntry>>;
			// like, say, their rivals scores or something.
			// then the callbacks need to recieve that info.
			getLevelOrder: (
				userID: integer,
				game: GamesForGroup["bms"],
			) => Promise<Array<string> | undefined>;
	  }
	| {
			forSpecificUser?: false;
			getBody: (game: GamesForGroup["bms"]) => Promise<Array<RawBMSTableEntry>>;
			getLevelOrder: (game: GamesForGroup["bms"]) => Promise<Array<string> | undefined>;
	  }
);

/**
 * Get an "absolute URL" for this bms table. I.E.
 * https://example.com/api/v1/games/bms-7k/tables/exampleTable/header.json
 */
export function BMSTableToAbsoluteURL(
	bmsTable: TachiBMSTable,
	game: GamesForGroup["bms"],
	headerOrBody: "body" | "header",
	userID: number | null,
) {
	return (
		ServerConfig.OUR_URL +
		path.join(
			"/api/v1/",

			// if this is a user-specific table, splice /users/$userID into this url.
			// (otherwise, don't do anything)
			bmsTable.forSpecificUser === true ? `users/${userID}` : "",

			`games/${game}/custom-tables/`,
			bmsTable.urlName,
			`${headerOrBody}.json`,
		)
	);
}

function GetUserID(req: Request) {
	if ("userID" in req.params) {
		const user = REQ_GetUser(req);

		return user.id;
	}

	throw new Error(`No userID in params here. Is this route mounted in the right place?`);
}

/**
 * Handle a request for a bms table. This endpoint should return "HTML" with the caveat
 * that atleast one of the lines should refer to a "bmstable" meta header.
 */
export function HandleBMSTableHTMLRequest(bmsTable: TachiBMSTable, req: Request, res: Response) {
	let absURL;
	const game = REQ_GetGame(req) as GamesForGroup["bms"];

	if (bmsTable.forSpecificUser === true) {
		const userID = GetUserID(req);

		absURL = BMSTableToAbsoluteURL(bmsTable, game, "header", userID);
	} else {
		absURL = BMSTableToAbsoluteURL(bmsTable, game, "header", null);
	}

	return res.status(200).send(`<html>
	<head>
	<meta name="bmstable" content="${absURL}">
	</head>
	<body>This is a stub page for the ${bmsTable.tableName} table. <a href="/">Go Home?</a></body>
	</html>`);
}

/**
 * Handle a request for a bms table's header.json.
 */
export async function HandleBMSTableHeaderRequest(
	bmsTable: TachiBMSTable,
	req: Request,
	res: Response,
) {
	try {
		let levelOrder;
		let dataUrl;
		const game = REQ_GetGame(req) as GamesForGroup["bms"];

		if (bmsTable.forSpecificUser === true) {
			const userID = GetUserID(req);

			dataUrl = BMSTableToAbsoluteURL(bmsTable, game, "body", userID);

			levelOrder = await bmsTable.getLevelOrder(userID, game);
		} else {
			levelOrder = await bmsTable.getLevelOrder(game);
			dataUrl = BMSTableToAbsoluteURL(bmsTable, game, "body", null);
		}

		const header: BMSTableHead = {
			data_url: dataUrl,
			name: bmsTable.tableName,
			symbol: bmsTable.symbol,
			levels: levelOrder,
		};

		return res.status(200).send(header);
	} catch (err) {
		log.error(
			{
				bmsTable,
				err,
			},
			`Failed to load header.json for table ${bmsTable.tableName}.`,
		);
		return res.status(500).send("Internal Server Error. Sorry about that.");
	}
}

export async function HandleBMSTableBodyRequest(
	bmsTable: TachiBMSTable,
	req: Request,
	res: Response,
) {
	try {
		let body;

		const game = REQ_GetGame(req) as GamesForGroup["bms"];

		if (bmsTable.forSpecificUser === true) {
			const userID = GetUserID(req);

			body = await bmsTable.getBody(userID, game);
		} else {
			body = await bmsTable.getBody(game);
		}

		return res.status(200).send(body);
	} catch (err) {
		log.error(
			{
				bmsTable,
				err,
			},
			`Failed to load body.json for table ${bmsTable.tableName}.`,
		);
		return res.status(500).send("Internal Server Error. Sorry about that.");
	}
}

/**
 * What custom tables does Tachi have?
 *
 * Adding a custom table here will just straight up add it to the site. Simple.
 */
export const CUSTOM_TACHI_BMS_TABLES: Array<TachiBMSTable> = [
	{
		urlName: "sieglindeEC",
		game: "bms-7k",
		symbol: "sgl-",
		tableName: "Sieglinde EC",
		description:
			"Folders for the 'Sieglinde' rating algorithm. These are rough estimates of how hard it is to EASY CLEAR a given chart.",
		async getBody() {
			const table = await GetTableForIDGuaranteed("bms-7K-sgl-EC");

			return TachiTableToBMSTableJSON(table);
		},
		async getLevelOrder() {
			const table = await GetTableForIDGuaranteed("bms-7K-sgl-EC");

			return GetFolderNamesInOrder(table);
		},
	},
	{
		urlName: "sieglindeHC",
		game: "bms-7k",
		symbol: "sgl-",
		tableName: "Sieglinde HC",
		description:
			"Folders for the 'Sieglinde' rating algorithm. These are rough estimates of how hard it is to HARD CLEAR a given chart.",
		async getBody() {
			const table = await GetTableForIDGuaranteed("bms-7K-sgl-HC");

			return TachiTableToBMSTableJSON(table);
		},
		async getLevelOrder() {
			const table = await GetTableForIDGuaranteed("bms-7K-sgl-HC");

			return GetFolderNamesInOrder(table);
		},
	},

	{
		urlName: "rival-info",
		game: null,
		symbol: "Rival",
		tableName: `${TachiConfig.NAME} Rival Stats`,
		forSpecificUser: true,
		description: `Folders for your rivals on ${TachiConfig.NAME}. This includes things like their recent highlights and plays.`,
		async getBody(userID, game) {
			const rivals = await GetRivalUsers(userID, game);

			const body: Array<RawBMSTableEntry> = [];

			const promises = [];

			for (const rival of rivals) {
				promises.push(
					(async () => {
						const scores = await GetRecentUGScores(rival.id, game);

						const data = await GetRelevantSongsAndCharts(scores);
						const charts = data.charts as unknown as Array<
							ChartDocument<GamesForGroup["bms"]>
						>;

						const songMap = CreateSongMap(data.songs);

						AppendAndConvertChartsToBMSBody(
							body,
							charts,
							songMap,
							`${rival.username} Recent Plays`,
						);
					})(),
				);

				promises.push(
					(async () => {
						const scores = await GetRecentUGScores(rival.id, game);

						const data = await GetRelevantSongsAndCharts(scores);
						const charts = data.charts as unknown as Array<
							ChartDocument<GamesForGroup["bms"]>
						>;

						const songMap = CreateSongMap(data.songs);

						AppendAndConvertChartsToBMSBody(
							body,
							charts,
							songMap,
							`${rival.username} Recent Highlights`,
						);
					})(),
				);
			}

			await Promise.all(promises);

			return body;
		},
		async getLevelOrder(userID, game) {
			const rivals = await GetRivalUsers(userID, game);

			return rivals.flatMap((rival) => [
				`${rival.username} Recent Plays`,
				`${rival.username} Recent Highlights`,
			]);
		},
	},
];
