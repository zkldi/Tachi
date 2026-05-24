import { ACTION_DeleteScore } from "#actions/delete-score";
import { ACTION_DeleteSession } from "#actions/delete-session";
import { ACTION_RebuildFolderChartLookup } from "#actions/rebuild-folder-chart-lookup";
import { ACTION_RecalcAllGameProfiles } from "#actions/recalc-all-game-profiles";
import { ACTION_SetUserImportProvidedClassStatus } from "#actions/set-user-import-provided-class-status";
import { ACTION_SetUserQuestSubmitterStatus } from "#actions/set-user-quest-submitter-status";
import { ACTION_SetUserSupporterStatus } from "#actions/set-user-supporter-status";
import {
	GetActions,
	GetActiveJobs,
	GetCronTaskExecutions,
	GetCronTasks,
	GetJobQueue,
} from "#lib/admin/admin-queries";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { drainPbDirtyAndDownstream, drainStatsQueuesFully } from "#lib/jobs/drain-dirty-queues";
import { SendSiteAnnouncementNotification } from "#lib/notifications/notification-wrappers";
import { withAdmin } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { TachiConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { RecalcAllScores, UpdateAllPBs } from "#utils/calculations/recalc-scores";
import DestroyUserGameProfile from "#utils/reset-state/destroy-user-game-profile";
import { GetUserWithIDGuaranteed, ResolveUser } from "#utils/user";
import { ExpectedErr } from "bliss";
import { GameToGameGroup, type V3Game } from "tachi-common";

import { API_V1_ROUTER } from "../_singleton";

API_V1_ROUTER.add("GET /admin/job-queue", withAdmin, async ({ input }) => {
	const page = Math.max(0, input.page ?? 0);
	const statusRaw = input.status;
	let status: number | undefined;

	if (statusRaw !== undefined && statusRaw !== "") {
		const n = Number.parseInt(statusRaw, 10);

		if (!Number.isNaN(n)) {
			status = n;
		}
	}

	const jobKind =
		input.job_kind !== undefined && input.job_kind !== "" ? input.job_kind : undefined;
	const scope = input.scope !== undefined && input.scope !== "" ? input.scope : undefined;

	const [activeJobs, jobQueue] = await Promise.all([
		GetActiveJobs(),
		GetJobQueue({ job_kind: jobKind, page, scope, status }),
	]);

	return success("Done.", {
		activeJobs,
		filters: { job_kind: jobKind, scope, status },
		jobQueue,
	});
});

API_V1_ROUTER.add("GET /admin/actions", withAdmin, async ({ input }) => {
	const page = Math.max(0, input.page ?? 0);
	const kind = input.kind !== undefined && input.kind !== "" ? input.kind : undefined;
	const username =
		input.username !== undefined && input.username !== "" ? input.username : undefined;

	const actions = await GetActions({ page, kind, username });

	return success("Done.", { actions, filters: { kind, username } });
});

API_V1_ROUTER.add("GET /admin/cron-tasks", withAdmin, async () => {
	const [tasks, executions] = await Promise.all([GetCronTasks(), GetCronTaskExecutions(100)]);

	return success("Done.", { executions, tasks });
});

API_V1_ROUTER.add("POST /admin/recalc-pbs", withAdmin, async () => {
	await UpdateAllPBs();
	await drainPbDirtyAndDownstream();

	return success(
		"Re-queued every distinct (user, chart) from scores into pb_dirty and drained pb/session/game_profile queues until idle.",
		{},
	);
});

API_V1_ROUTER.add("POST /admin/delete-score", withAdmin, async ({ input, req }) => {
	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_DeleteScore(taker, { id: input.scoreID });

	return success("Removed score.", {});
});

API_V1_ROUTER.add("POST /admin/delete-session", withAdmin, async ({ input, req }) => {
	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_DeleteSession(taker, { id: input.sessionID });

	return success("Removed session.", {});
});

API_V1_ROUTER.add("POST /admin/destroy-ugpt", withAdmin, async ({ input }) => {
	const ugpt = await DB.selectFrom("game_profile")
		.where("user_id", "=", input.userID)
		.where("game", "=", input.game)
		.executeTakeFirst();

	if (!ugpt) {
		throw new ExpectedErr(404, `No stats for ${input.userID} (${input.game}) exist.`);
	}

	await DestroyUserGameProfile(input.userID, input.game);

	return success(`Completely destroyed game profile for ${input.userID} (${input.game}).`, {});
});

API_V1_ROUTER.add("POST /admin/recalc", withAdmin, async () => {
	await RecalcAllScores();
	await drainStatsQueuesFully();

	return success(
		"Enqueued every chart for score re-derivation and drained score/pb/session/game_profile queues until idle.",
		{},
	);
});

API_V1_ROUTER.add("POST /admin/recalc-profiles", withAdmin, async ({ req }) => {
	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_RecalcAllGameProfiles(taker, {});

	return success(
		"Enqueued all game_profile rows and distinct committed score (user, game) pairs into game_profile_dirty, then drained that queue until idle.",
		{},
	);
});

API_V1_ROUTER.add("POST /admin/announcement", withAdmin, async ({ input }) => {
	const game = input.game as V3Game | undefined;

	if (game) {
		if (!TachiConfig.GAME_GROUPS.includes(GameToGameGroup(game))) {
			throw new ExpectedErr(400, `This game is not enabled '${game}'.`);
		}
	}

	await SendSiteAnnouncementNotification(input.title, game);

	return success(`Sent notification '${input.title}'.`, {});
});

API_V1_ROUTER.add("POST /admin/supporter/:userID", withAdmin, async ({ params, req }) => {
	const target = await ResolveUser(params.userID);

	if (!target) {
		throw new ExpectedErr(404, "This user does not exist.");
	}

	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_SetUserSupporterStatus(taker, { isSupporter: true, userID: target.id });

	return success("Done.", {});
});

API_V1_ROUTER.add("DELETE /admin/supporter/:userID", withAdmin, async ({ params, req }) => {
	const target = await ResolveUser(params.userID);

	if (!target) {
		throw new ExpectedErr(404, "This user does not exist.");
	}

	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_SetUserSupporterStatus(taker, { isSupporter: false, userID: target.id });

	return success("Done.", {});
});

API_V1_ROUTER.add("POST /admin/rebuild-folder-chart-lookup", withAdmin, async ({ input, req }) => {
	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const user = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

	const result = await ACTION_RebuildFolderChartLookup(taker, { folderId: input.folderId });

	return success(
		`Rebuilt folder_chart_lookup (${result.folderCount} folders, ${result.rowCount} rows).`,
		result,
	);
});

API_V1_ROUTER.add("POST /admin/quest-submitter/:userID", withAdmin, async ({ params, req }) => {
	const target = await ResolveUser(params.userID);

	if (!target) {
		throw new ExpectedErr(404, "This user does not exist.");
	}

	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_SetUserQuestSubmitterStatus(taker, { canSubmit: true, userID: target.id });

	return success("Done.", {});
});

API_V1_ROUTER.add("DELETE /admin/quest-submitter/:userID", withAdmin, async ({ params, req }) => {
	const target = await ResolveUser(params.userID);

	if (!target) {
		throw new ExpectedErr(404, "This user does not exist.");
	}

	const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const adminUser = await GetUserWithIDGuaranteed(adminUserID);
	const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

	await ACTION_SetUserQuestSubmitterStatus(taker, { canSubmit: false, userID: target.id });

	return success("Done.", {});
});

API_V1_ROUTER.add(
	"POST /admin/import-provided-class/:userID",
	withAdmin,
	async ({ params, req }) => {
		const target = await ResolveUser(params.userID);

		if (!target) {
			throw new ExpectedErr(404, "This user does not exist.");
		}

		const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
		const adminUser = await GetUserWithIDGuaranteed(adminUserID);
		const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

		await ACTION_SetUserImportProvidedClassStatus(taker, {
			canImport: true,
			userID: target.id,
		});

		return success("Done.", {});
	},
);

API_V1_ROUTER.add(
	"DELETE /admin/import-provided-class/:userID",
	withAdmin,
	async ({ params, req }) => {
		const target = await ResolveUser(params.userID);

		if (!target) {
			throw new ExpectedErr(404, "This user does not exist.");
		}

		const adminUserID = req[SYMBOL_TACHI_API_AUTH].userID!;
		const adminUser = await GetUserWithIDGuaranteed(adminUserID);
		const taker = { acct: { id: adminUser.id, username: adminUser.username }, ip: req.ip };

		await ACTION_SetUserImportProvidedClassStatus(taker, {
			canImport: false,
			userID: target.id,
		});

		return success("Done.", {});
	},
);

API_V1_ROUTER.add("POST /admin/reprocess-all-goals", withAdmin, () => {
	throw new ExpectedErr(501, "Not implemented.");
});
