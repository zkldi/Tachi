import { SELECT_USER, ToUserDocument } from "#lib/db-formats/user";
import { TachiConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { GetSongForIDGuaranteed } from "#utils/db";
import { EscapeForILIKE } from "#utils/misc";
import {
	FindBMSChartsByHashMd5OrSha256,
	FindITGChartsByHashGSv3,
	FindPMSChartsByHashMd5OrSha256,
	FindUSCChartsByHashSHA1,
} from "#utils/queries/charts";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { GetOnlineCutoff } from "#utils/user";
import {
	type ChartDocument,
	type FolderDocument,
	type GameGroup,
	type GamesForGroup,
	type integer,
	type SongDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import { SearchFoldersFtsAndTrgmGlobal } from "./folders";
import { type SearchSessionHit, SearchSessionsForUserGptFtsAndTrgm } from "./session-search";
import { SearchSpecificGameSongs, type SongSearchReturn } from "./songs";

export type { SearchSessionHit } from "./session-search";

export function SearchSessions(
	search: string,
	game: V3Game,
	userID: integer,
	limit = 100,
): Promise<Array<SearchSessionHit>> {
	return SearchSessionsForUserGptFtsAndTrgm(userID, game, search, limit);
}

/**
 * Searches the user collection for users that are *like* the
 * provided string.
 *
 * We use regex matching because $text matches words, and users
 * aren't allowed spaces in their name. In short, $text is very
 * poor at actually matching usernames.
 */
export function SearchUsersRegExp(
	search: string,
	matchOnline = false,
): Promise<Array<UserDocument>> {
	const likeEsc = EscapeForILIKE(search.toLowerCase());

	const onlineCutoff = UnixMillisecondsToISO8601(GetOnlineCutoff());

	let q = DB.selectFrom("account")
		.select(SELECT_USER)
		.where("normalized_username", "like", `%${likeEsc}%`);

	if (matchOnline) {
		q = q.where("last_seen", ">", onlineCutoff);
	}

	return q
		.limit(25)
		.execute()
		.then((res) => res.map(ToUserDocument));
}

/**
 * Terrible function name!
 * Searches a single game, but optimised for the searchAllGames return.
 */
async function SearchAllGamesSingleGame(game: GameGroup, search: string) {
	const songs = (await SearchSpecificGameSongs(game, search, 10)) as Array<
		{
			game: GameGroup;
		} & SongSearchReturn
	>;

	for (const song of songs) {
		song.game = game;
	}

	return songs;
}

/**
 * Searches all games' songs.
 */
export async function SearchGamesSongs(search: string, games: Array<GameGroup> | null) {
	const promises = [];

	for (const game of games ?? TachiConfig.GAME_GROUPS) {
		promises.push(SearchAllGamesSingleGame(game, search));
	}

	const res = await Promise.all(promises);

	return res.flat(1).sort((a, b) => b.__textScore - a.__textScore);
}

export async function SearchForChartHash(search: string) {
	const [bmsCharts, pmsCharts, uscCharts, itgCharts] = await Promise.all([
		FindBMSChartsByHashMd5OrSha256(search),
		FindPMSChartsByHashMd5OrSha256(search),
		FindUSCChartsByHashSHA1(search),
		FindITGChartsByHashGSv3(search),
	]);

	const output: Record<
		GamesForGroup["bms" | "itg" | "pms" | "usc"],
		Array<{
			chart: ChartDocument;
			playcount: null;
			song: SongDocument;
		}>
	> = {
		"bms-7k": [],
		"bms-14k": [],
		"pms-controller": [],
		"pms-keyboard": [],
		"usc-controller": [],
		"usc-keyboard": [],
		"itg-stamina": [],
	};

	const push = async (chart: ChartDocument) => {
		const key = chart.game as GamesForGroup["bms" | "itg" | "pms" | "usc"];
		if (!(key in output)) {
			return;
		}

		const song = await GetSongForIDGuaranteed(chart.song.id);

		output[key].push({
			song,
			chart,
			playcount: null,
		});
	};

	for (const chart of bmsCharts) {
		await push(chart);
	}

	for (const chart of pmsCharts) {
		await push(chart);
	}

	for (const chart of itgCharts) {
		await push(chart);
	}

	for (const chart of uscCharts) {
		await push(chart);
	}

	return output;
}

export function SearchFolders(
	search: string,
	games: Array<V3Game> | null = null,
	limit = 500,
): Promise<Array<{ __textScore: number } & FolderDocument>> {
	if (games !== null) {
		return SearchFoldersFtsAndTrgmGlobal(search, {
			limit,
			games,
		});
	}

	return SearchFoldersFtsAndTrgmGlobal(search, { limit });
}
