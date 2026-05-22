import { ACTION_UpdateUgptShowcase as ACTION_UpdateUGPTShowcase } from "#actions/update-ugpt-showcase";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetChartById } from "#lib/db-formats/chart";
import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import { GetUGPTSettingsDocument } from "#lib/db-formats/ugpt-settings";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { EvaluateShowcaseStat } from "#lib/showcase/evaluator";
import { GetRelatedStatDocuments } from "#lib/showcase/get-related";
import { EvaluateUsersStatsShowcase } from "#lib/showcase/get-stats";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetUserWithIDGuaranteed, ResolveUser } from "#utils/user";
import { ExpectedErr } from "bliss";
import {
	FormatGame,
	GetGameConfig,
	GetScoreMetrics,
	type integer,
	type ShowcaseStatDetails,
} from "tachi-common";

/**
 * Evaluate this users set stats.
 *
 * @name GET /api/v1/users/:userID/games/:game/showcase
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/showcase",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		let projectUser: integer | undefined;

		if (typeof input.projectUser === "string") {
			const resolved = await ResolveUser(input.projectUser);

			if (!resolved) {
				throw new ExpectedErr(
					404,
					`The projected user ${input.projectUser} does not exist.`,
				);
			}

			projectUser = resolved.id;
		}

		const results = await EvaluateUsersStatsShowcase(user.id, game, projectUser);

		return success(`Evaluated ${results.length} stats.`, results);
	},
);

/**
 * Evaluate a single custom folder or chart stat.
 *
 * @name GET /api/v1/users/:userID/games/:game/showcase/custom
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/showcase/custom",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser, game } = ctx;
		const gameConfig = GetGameConfig(game);
		const availableMetrics = GetScoreMetrics(gameConfig, ["DECIMAL", "ENUM", "INTEGER"]);

		let stat: ShowcaseStatDetails;

		if (input.mode === "folder") {
			if (!input.folderSlug) {
				throw new ExpectedErr(400, "folderSlug is required for folder mode.");
			}

			if (input.gte === undefined) {
				throw new ExpectedErr(400, "gte is required for folder mode.");
			}

			if (input.metric === undefined || input.metric === "") {
				throw new ExpectedErr(400, "metric is required for folder mode.");
			}

			if (!availableMetrics.includes(input.metric)) {
				throw new ExpectedErr(
					400,
					`Invalid metric ${input.metric}. Expected any of ${availableMetrics.join(", ")}.`,
				);
			}

			const folder = await LoadFolderDocumentByGameAndSlug(game, input.folderSlug);

			if (!folder || folder.game !== game) {
				throw new ExpectedErr(
					400,
					`Invalid folderSlug - all folders must be for ${FormatGame(game)}, and exist.`,
				);
			}

			stat = {
				slug: folder.slug,
				gte: input.gte,
				metric: input.metric,
				mode: "folder",
			};
		} else {
			if (!input.chartID) {
				throw new ExpectedErr(400, "chartID is required for chart mode.");
			}

			const chart = await GetChartById(input.chartID);

			if (!chart || chart.game !== game) {
				throw new ExpectedErr(400, "Chart does not exist, or is not for this game.");
			}

			stat = {
				chartID: input.chartID,
				mode: "chart",
			};
		}

		const result = await EvaluateShowcaseStat(game, stat, requestedUser.id);
		const related = await GetRelatedStatDocuments(stat, game);

		return success(`Evaluated Stat for ${requestedUser.username}`, { related, result, stat });
	},
);

/**
 * Replaces a user's stat showcase.
 *
 * @name PUT /api/v1/users/:userID/games/:game/showcase
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/games/:game/showcase",
	withUserGameProfile,
	async ({ ctx, input, req }) => {
		const { requestedUser: user, game } = ctx;

		const showcase = input.showcase;

		if (!Array.isArray(showcase)) {
			throw new ExpectedErr(400, "No stats provided, or was not an array.");
		}

		const stats = showcase as Array<unknown>;

		if (stats.length > 6) {
			throw new ExpectedErr(400, "You are only allowed 6 stats at once.");
		}

		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			throw new ExpectedErr(401, "Authentication is required.");
		}

		const authedUser = await GetUserWithIDGuaranteed(authUserID);
		const taker = { acct: { id: authedUser.id, username: authedUser.username }, ip: req.ip };

		await ACTION_UpdateUGPTShowcase(taker, {
			game,
			stats: stats as Array<ShowcaseStatDetails>,
			userID: user.id,
		});

		const settings = await GetUGPTSettingsDocument(user.id, game);

		return success("Updated showcase.", settings);
	},
);
