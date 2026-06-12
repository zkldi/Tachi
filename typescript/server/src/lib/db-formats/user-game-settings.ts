import DB from "#services/pg/db";
import { type Selection } from "kysely";
import {
	type integer,
	type ShowcaseStatChart,
	type ShowcaseStatDetails,
	type UserGameSettingsDocument,
	type V3Game,
} from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_GAME_PROFILE_SETTINGS = [
	"game_profile.user_id",
	"game_profile.game",
	"game_profile.pf_preferred_score_alg",
	"game_profile.pf_preferred_session_alg",
	"game_profile.pf_preferred_profile_alg",
	"game_profile.pf_preferred_default_enum",
	"game_profile.pf_default_table",
	"game_profile.pf_preferred_ranking",
	"game_profile.data",
	"game_profile.showcase",
] as const;

export type GameProfilePreferenceRow = Selection<
	Database,
	"game_profile",
	(typeof SELECT_GAME_PROFILE_SETTINGS)[number]
>;

export function ToUserGameSettingsDocument(
	row: GameProfilePreferenceRow,
	rivals: Array<integer>,
): UserGameSettingsDocument {
	const gameSpecific = row.data as UserGameSettingsDocument["preferences"]["gameSpecific"];
	const rawShowcase = row.showcase as Array<ShowcaseStatDetails>;
	const stats = normalizeShowcaseStats(rawShowcase);

	return {
		userID: row.user_id,
		game: row.game,
		preferences: {
			defaultTable: row.pf_default_table,
			gameSpecific,
			preferredDefaultEnum: row.pf_preferred_default_enum,
			preferredProfileAlg:
				row.pf_preferred_profile_alg as UserGameSettingsDocument["preferences"]["preferredProfileAlg"],
			preferredRanking:
				row.pf_preferred_ranking as UserGameSettingsDocument["preferences"]["preferredRanking"],
			preferredScoreAlg:
				row.pf_preferred_score_alg as UserGameSettingsDocument["preferences"]["preferredScoreAlg"],
			preferredSessionAlg:
				row.pf_preferred_session_alg as UserGameSettingsDocument["preferences"]["preferredSessionAlg"],
			stats,
		},
		rivals,
	};
}

/**
 * Full UserGame settings document (preferences + rivals + showcase stats) from Postgres.
 */
export async function GetUserGameSettingsDocument(
	userID: integer,
	game: V3Game,
): Promise<UserGameSettingsDocument | null> {
	const row = await DB.selectFrom("game_profile")
		.select(SELECT_GAME_PROFILE_SETTINGS)
		.where("game_profile.user_id", "=", userID)
		.where("game_profile.game", "=", game)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	const rivalRows = await DB.selectFrom("game_rival")
		.select("rival")
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.execute();

	const rivals = rivalRows.map((r) => r.rival);

	return ToUserGameSettingsDocument(row, rivals);
}

/** Strips legacy `metric` from chart entries stored before chart showcase was PB+playcount-only. */
// TODO(zk): nonsense, lets just remove this
// with a migration?
function normalizeShowcaseStats(raw: Array<ShowcaseStatDetails>): Array<ShowcaseStatDetails> {
	return raw.map((stat) => {
		if (stat.mode === "chart") {
			const s = stat as { metric?: string } & ShowcaseStatChart;
			return { mode: "chart", chartID: s.chartID };
		}
		return stat;
	});
}
