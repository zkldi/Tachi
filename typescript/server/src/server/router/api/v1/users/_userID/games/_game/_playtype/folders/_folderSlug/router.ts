import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import {
	GetEnumDistForFolders,
	GetFolderChartsAndSongs,
	GetPBsOnFolder,
} from "#lib/folders/folders";
import { LoadFolderEvolutionPayload } from "#lib/folders/table-evolution";
import { withSelf, withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { GetFolderTimelineScores } from "#utils/queries/scores";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";
import { GetGameConfig, GetScoreMetricConf, ValidateMetric } from "tachi-common";

/**
 * Returns user charts/songs/stats for a specific folder.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders/:folderSlug
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders/:folderSlug",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder) {
			throw new ExpectedErr(404, "This folder does not exist.");
		}

		const { charts, pbs, songs } = await GetPBsOnFolder(user.id, folder);
		const stats = await GetEnumDistForFolders(user.id, [folder]);

		return success(`Returned data for folder ${folder.title}`, {
			charts,
			folder,
			songs,
			stats: stats[0] ?? null,
			pbs,
		});
	},
);

/**
 * Returns aggregated enum stats for the user on this folder.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders/:folderSlug/stats
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders/:folderSlug/stats",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder || folder.game !== game) {
			throw new ExpectedErr(404, "This folder does not exist.");
		}

		const stats = await GetEnumDistForFolders(requestedUser.id, [folder]);

		return success(`Returned statistics for ${folder.title}.`, {
			folder,
			stats: stats[0] ?? null,
		});
	},
);

/**
 * Record that the user viewed this folder. Requires session-level auth as this user.
 *
 * @name POST /api/v1/users/:userID/games/:game/folders/:folderSlug/viewed
 */
API_V1_ROUTER.add(
	"POST /users/:userID/games/:game/folders/:folderSlug/viewed",
	withSelf,
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder || folder.game !== game) {
			throw new ExpectedErr(404, "This folder does not exist.");
		}

		await DB.insertInto("folder_view")
			.values({
				folder_id: folder.folderID,
				last_viewed: UnixMillisecondsToISO8601(Date.now()),
				user_id: user.id,
			})
			.onConflict((oc) =>
				oc.columns(["user_id", "folder_id"]).doUpdateSet({
					last_viewed: sql`excluded.last_viewed`,
				}),
			)
			.execute();

		return success(`Recorded a view on ${folder.title}.`, {});
	},
);

/**
 * Returns the users scores in order of when they met the given criteria.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders/:folderSlug/timeline
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders/:folderSlug/timeline",
	withUserGameProfile,
	async ({ ctx, params, input }) => {
		const { requestedUser: user, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder) {
			throw new ExpectedErr(404, "This folder does not exist.");
		}

		const gameConfig = GetGameConfig(game);
		const metric = input.criteriaType;
		const conf = GetScoreMetricConf(gameConfig, metric);

		if (!conf || conf.type !== "ENUM") {
			throw new ExpectedErr(
				400,
				`Invalid metric '${metric}' passed. Expected an ENUM for this game.`,
			);
		}

		const criteriaValue = conf.values.indexOf(input.criteriaValue);

		if (criteriaValue === -1) {
			throw new ExpectedErr(
				400,
				`Invalid criteriaValue of ${input.criteriaValue} for ${metric}.`,
			);
		}

		const err = ValidateMetric(gameConfig, metric, criteriaValue);

		if (typeof err === "string") {
			throw new ExpectedErr(400, err);
		}

		const { songs, charts } = await GetFolderChartsAndSongs(folder);

		const scores = await GetFolderTimelineScores(
			user.id,
			game,
			charts.map((e) => e.chartID),
			metric,
			criteriaValue,
		);

		return success(`Returned ${scores.length} scores for ${charts.length} charts.`, {
			charts,
			folder,
			scores,
			songs,
		});
	},
);

/**
 * **Folder evolution:** distinct enum milestones (per metric, per chart) at or above each metric's
 * `minimumRelevantValue`, scoped to charts in this folder — same semantics as table evolution.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders/:folderSlug/evolution
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders/:folderSlug/evolution",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder || folder.game !== game) {
			throw new ExpectedErr(404, "This folder does not exist.");
		}

		const body = await LoadFolderEvolutionPayload(user.id, game, folder);

		return success(
			`Returned ${body.events.length} folder evolution events for ${folder.title}.`,
			body,
		);
	},
);
