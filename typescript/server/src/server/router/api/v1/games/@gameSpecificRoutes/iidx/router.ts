import {
	CUSTOM_TACHI_IIDX_PLAYLISTS,
	type TachiIIDXPlaylist,
} from "#lib/game-specific/iidx-playlists";
import { withGame } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { ExpectedErr } from "bliss";
import { type GamesForGroup, GameToGameGroup } from "tachi-common";

/**
 * List all the playlists we have available.
 *
 * @name GET /api/v1/games/:game/playlists
 */
API_V1_ROUTER.add("GET /games/:game/playlists", withGame, ({ ctx }) => {
	const game = ctx.game as GamesForGroup["iidx"];

	if (GameToGameGroup(game) !== "iidx") {
		throw new ExpectedErr(404, `No playlists exist for ${game}.`);
	}

	const playlists = CUSTOM_TACHI_IIDX_PLAYLISTS.filter((e) => e.game === null || e.game === game);

	const body: Array<{
		description: string;
		forSpecificUser?: boolean;
		playlistName: string;
		urlName: string;
	}> = [];

	for (const playlist of playlists) {
		body.push({
			description: playlist.description,
			forSpecificUser: playlist.forSpecificUser,
			playlistName: playlist.playlistName,
			urlName: playlist.urlName,
		});
	}

	return success(`Found ${playlists.length} playlist(s)`, body);
});

/**
 * Retrieve this playlist.
 *
 * @name GET /api/v1/games/:game/playlists/:playlistID
 */
API_V1_ROUTER.add(
	"GET /games/:game/playlists/:playlistID",
	withGame,
	async ({ ctx, params, res }) => {
		const game = ctx.game as GamesForGroup["iidx"];

		if (GameToGameGroup(game) !== "iidx") {
			throw new ExpectedErr(404, `No playlists exist for ${game}.`);
		}

		const playlist: TachiIIDXPlaylist | undefined = CUSTOM_TACHI_IIDX_PLAYLISTS.find(
			(e) => (e.game === null || e.game === game) && e.urlName === params.playlistID,
		);

		if (!playlist) {
			throw new ExpectedErr(
				404,
				`No such playlist '${params.playlistID}' exists for '${game}'.`,
			);
		}

		if (playlist.forSpecificUser === true) {
			throw new ExpectedErr(
				404,
				`This playlist is for a specific user. Use the /users/:userID endpoint instead.`,
			);
		}

		const payload = await playlist.getPlaylists(game as "iidx-dp" | "iidx-sp");
		res.status(200).json(payload);
		return success("unused", null);
	},
);
