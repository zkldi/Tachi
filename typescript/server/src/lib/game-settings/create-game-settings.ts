import { type V3Game } from "tachi-common";

/**
 * Default preference columns for a new `game_profile` row (ratings/classes live alongside these).
 */
export function newGameProfilePreferenceColumns(game: V3Game) {
	const gameSpecific =
		game === "iidx-sp" || game === "iidx-dp"
			? {
					display2DXTra: false,
					bpiTarget: 0,
				}
			: {};

	return {
		pf_preferred_score_alg: null as string | null,
		pf_preferred_session_alg: null as string | null,
		pf_preferred_profile_alg: null as string | null,
		pf_preferred_default_enum: null as string | null,
		pf_default_table: null as string | null,
		pf_preferred_ranking: null as string | null,
		data: JSON.stringify(gameSpecific),
		showcase: JSON.stringify([]),
	};
}
