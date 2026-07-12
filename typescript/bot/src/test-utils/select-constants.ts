/** Kysely column lists for tests (mirrors `tachi-server` db-formats where applicable). */

export const SELECT_ACTION = [
	"action.row_id",
	"action.user_id",
	"action.ip",
	"action.app",
	"action.kind",
	"action.result",
	"action.input",
	"action.output",
	"action.ts_start",
	"action.ts_end",
] as const;

export const SELECT_PRIV_DISCORD_USER_MAP = [
	"priv_discord_user_map.user_id",
	"priv_discord_user_map.discord_id",
	"priv_discord_user_map.api_token",
] as const;
