import type { ActionName } from "#lib/actions/actions";
import type { ActionTaker } from "bliss";

import { ACTION_AddGoal } from "#actions/add-goal";
import { ACTION_BacksyncBmsPmsSeeds } from "#actions/backsync-bms-pms-seeds";
import { ACTION_BMSTableSync } from "#actions/bms-table-sync";
import { ACTION_ChangeBanner } from "#actions/change-banner";
import { ACTION_ChangeEmail } from "#actions/change-email";
import { ACTION_ChangePassword } from "#actions/change-password";
import { ACTION_ChangePfp } from "#actions/change-pfp";
import { ACTION_ChangeUsername } from "#actions/change-username";
import { ACTION_CreateApiClient } from "#actions/create-api-client";
import { ACTION_CreateApiToken } from "#actions/create-api-token";
import { ACTION_CreateInvite } from "#actions/create-invite";
import { ACTION_CreateOAuth2AuthCode } from "#actions/create-oauth2-auth-code";
import { ACTION_CustomiseScore } from "#actions/customise-score";
import { ACTION_DeleteAllNotifications } from "#actions/delete-all-notifications";
import { ACTION_DeleteApiClient } from "#actions/delete-api-client";
import { ACTION_DeleteApiToken } from "#actions/delete-api-token";
import { ACTION_DeleteBanner } from "#actions/delete-banner";
import { ACTION_DeleteCgCardInfo } from "#actions/delete-cg-card-info";
import { ACTION_DeleteImport } from "#actions/delete-import";
import { ACTION_DeleteMytCardInfo } from "#actions/delete-myt-card-info";
import { ACTION_DeletePfp } from "#actions/delete-pfp";
import { ACTION_DeleteScore } from "#actions/delete-score";
import { ACTION_DeleteSession } from "#actions/delete-session";
import { ACTION_FollowUser } from "#actions/follow-user";
import { ACTION_ImportSeeds } from "#actions/import-seeds";
import { ACTION_InstallBuiltinClient } from "#actions/install-builtin-client";
import { ACTION_MarkAllNotificationsRead } from "#actions/mark-all-notifications-read";
import { ACTION_PatchUserGameSettings } from "#actions/patch-user-game-settings";
import { ACTION_RebuildFolderChartLookup } from "#actions/rebuild-folder-chart-lookup";
import { ACTION_RecalcAllGameProfiles } from "#actions/recalc-all-game-profiles";
import { ACTION_RemoveGoalSubscription } from "#actions/remove-goal-subscription";
import { ACTION_ResendVerifyEmail } from "#actions/resend-verify-email";
import { ACTION_ResetApiClientSecret } from "#actions/reset-api-client-secret";
import { ACTION_RevokeKaiAuthToken } from "#actions/revoke-kai-auth-token";
import { ACTION_ScoreImport } from "#actions/score-import";
import { ACTION_SetRivals } from "#actions/set-rivals";
import { ACTION_SetUserSupporterStatus } from "#actions/set-user-supporter-status";
import { ACTION_UGSSnapshot } from "#actions/ugs-snapshot";
import { ACTION_UnfollowUser } from "#actions/unfollow-user";
import { ACTION_UpdateApiClient } from "#actions/update-api-client";
import { ACTION_UpdateBpiData } from "#actions/update-bpi-data";
import { ACTION_UpdateCgCardInfo } from "#actions/update-cg-card-info";
import { ACTION_UpdateDpTiers } from "#actions/update-dp-tiers";
import { ACTION_UpdateFervidexSettings } from "#actions/update-fervidex-settings";
import { ACTION_UpdateKshookSv6cSettings } from "#actions/update-kshook-sv6c-settings";
import { ACTION_UpdateMytCardInfo } from "#actions/update-myt-card-info";
import { ACTION_UpdateSession } from "#actions/update-session";
import { ACTION_UpdateSp12Data } from "#actions/update-sp12-data";
import { ACTION_UpdateUserGameShowcase as ACTION_UpdateUserGameShowcase } from "#actions/update-ugpt-showcase";
import { ACTION_UpdateUser } from "#actions/update-user";
import { ACTION_UpdateUserSettings } from "#actions/update-user-settings";
import { ACTION_UpsertKaiAuthToken } from "#actions/upsert-kai-auth-token";

/** Narrow type for CLI / programmatic dispatch; each real handler is stricter. */
export type AuthenticatedActionHandler = (
	taker: ActionTaker,
	input: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Maps each {@link ActionName} to its server implementation. When adding a new
 * authenticated action, register it here (and in {@link ActionSignatures}).
 */
export const authenticatedActionHandlers = {
	ADD_GOAL: ACTION_AddGoal,
	BACKSYNC_BMS_PMS_SEEDS: ACTION_BacksyncBmsPmsSeeds,
	BMS_TABLE_SYNC: ACTION_BMSTableSync,
	CHANGE_BANNER: ACTION_ChangeBanner,
	CHANGE_EMAIL: ACTION_ChangeEmail,
	CHANGE_PASSWORD: ACTION_ChangePassword,
	CHANGE_PFP: ACTION_ChangePfp,
	CHANGE_USERNAME: ACTION_ChangeUsername,
	CREATE_API_CLIENT: ACTION_CreateApiClient,
	CREATE_API_TOKEN: ACTION_CreateApiToken,
	CREATE_INVITE: ACTION_CreateInvite,
	CREATE_OAUTH2_AUTH_CODE: ACTION_CreateOAuth2AuthCode,
	CUSTOMISE_SCORE: ACTION_CustomiseScore,
	DELETE_ALL_NOTIFICATIONS: ACTION_DeleteAllNotifications,
	DELETE_API_CLIENT: ACTION_DeleteApiClient,
	DELETE_API_TOKEN: ACTION_DeleteApiToken,
	DELETE_BANNER: ACTION_DeleteBanner,
	DELETE_CG_CARD_INFO: ACTION_DeleteCgCardInfo,
	DELETE_IMPORT: ACTION_DeleteImport,
	DELETE_MYT_CARD_INFO: ACTION_DeleteMytCardInfo,
	DELETE_PFP: ACTION_DeletePfp,
	DELETE_SCORE: ACTION_DeleteScore,
	DELETE_SESSION: ACTION_DeleteSession,
	FOLLOW_USER: ACTION_FollowUser,
	IMPORT_SEEDS: ACTION_ImportSeeds,
	INSTALL_BUILTIN_CLIENT: ACTION_InstallBuiltinClient,
	MARK_ALL_NOTIFICATIONS_READ: ACTION_MarkAllNotificationsRead,
	PATCH_USER_GAME_SETTINGS: ACTION_PatchUserGameSettings,
	REBUILD_FOLDER_CHART_LOOKUP: ACTION_RebuildFolderChartLookup,
	RECALC_ALL_GAME_PROFILES: ACTION_RecalcAllGameProfiles,
	REMOVE_GOAL_SUBSCRIPTION: ACTION_RemoveGoalSubscription,
	RESEND_VERIFY_EMAIL: ACTION_ResendVerifyEmail,
	RESET_API_CLIENT_SECRET: ACTION_ResetApiClientSecret,
	REVOKE_KAI_AUTH_TOKEN: ACTION_RevokeKaiAuthToken,
	SCORE_IMPORT: ACTION_ScoreImport,
	SET_RIVALS: ACTION_SetRivals,
	SET_USER_SUPPORTER_STATUS: ACTION_SetUserSupporterStatus,
	UNFOLLOW_USER: ACTION_UnfollowUser,
	UPDATE_API_CLIENT: ACTION_UpdateApiClient,
	UPDATE_BPI_DATA: ACTION_UpdateBpiData,
	UPDATE_CG_CARD_INFO: ACTION_UpdateCgCardInfo,
	UPDATE_DP_TIERS: ACTION_UpdateDpTiers,
	UPDATE_FERVIDEX_SETTINGS: ACTION_UpdateFervidexSettings,
	UPDATE_KSHOOK_SV6C_SETTINGS: ACTION_UpdateKshookSv6cSettings,
	UPDATE_MYT_CARD_INFO: ACTION_UpdateMytCardInfo,
	UPDATE_SESSION: ACTION_UpdateSession,
	UPDATE_SP12_DATA: ACTION_UpdateSp12Data,
	UPDATE_USER_GAME_SHOWCASE: ACTION_UpdateUserGameShowcase,
	UPDATE_USER: ACTION_UpdateUser,
	UPDATE_USER_SETTINGS: ACTION_UpdateUserSettings,
	UGS_SNAPSHOT: ACTION_UGSSnapshot,
	UPSERT_KAI_AUTH_TOKEN: ACTION_UpsertKaiAuthToken,
} as Record<ActionName, AuthenticatedActionHandler>;
