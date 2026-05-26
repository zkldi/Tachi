import type { GameGroup } from "tachi-common";

/** Fallback hero/background when no game is selected or a group has no variants. */
export const DEFAULT_GAME_BANNER_REL_PATH = "/game-banners/default.webp";

/**
 * How many CDN banner variants exist per game group, named
 * `{gameGroup}-{n}.webp` with `n` in `[1, count]` (one-based).
 *
 * Bump the count when new banner images are added for a group on the CDN.
 */
export const GAME_GROUP_BANNER_COUNTS = {
	iidx: 1,
	museca: 1,
	chunithm: 1,
	bms: 1,
	gitadora: 1,
	jubeat: 1,
	maimai: 1,
	maimaidx: 1,
	popn: 1,
	sdvx: 1,
	usc: 1,
	wacca: 1,
	pms: 1,
	itg: 1,
	arcaea: 1,
	ongeki: 1,
	ddr: 1,
} as const satisfies Record<GameGroup, number>;

export function getGameGroupBannerCount(gameGroup: GameGroup): number {
	return GAME_GROUP_BANNER_COUNTS[gameGroup];
}

/**
 * CDN-relative path for this group's banner. Picks `{gameGroup}-n.webp` where
 * `n = ((local weekday from Date#getDay()) % count) + 1` — same backdrop all Sunday, etc.
 *
 * Bump GAME_GROUP_BANNER_COUNTS when adding images; weekdays cycle indices in `[1, count]`.
 */
export function getGameGroupBannerRelPathForWeekday(gameGroup: GameGroup): string {
	const count = GAME_GROUP_BANNER_COUNTS[gameGroup];
	if (count <= 0) {
		return DEFAULT_GAME_BANNER_REL_PATH;
	}

	const weekday = new Date().getDay(); // 0 = Sunday … 6 = Saturday
	const n = (weekday % count) + 1;
	return `/game-banners/${gameGroup}-${n}.webp`;
}
