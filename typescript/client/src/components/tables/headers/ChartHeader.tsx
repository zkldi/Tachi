import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameRatingSystem } from "#lib/types";
import { IsNullish } from "#util/misc";
import { type ChartDocument, type V3Game } from "tachi-common";

import { type Header } from "../components/TachiTable";

export function CascadingRatingValue(game: V3Game, chartA: ChartDocument, chartB: ChartDocument) {
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	if (chartA.levelNum !== chartB.levelNum) {
		return chartA.levelNum - chartB.levelNum;
	}

	for (const rating of gptImpl.ratingSystems as GameRatingSystem<any>[]) {
		const a = rating.toNumber(chartA);
		const b = rating.toNumber(chartB);
		if (a !== b) {
			if (IsNullish(a)) {
				return -Infinity;
			} else if (IsNullish(b)) {
				return Infinity;
			}

			return a! - b!;
		}
	}

	// these things are equal on all counts
	return 0;
}

export default function ChartHeader<D>(
	game: V3Game,
	chartGetter: (k: D) => ChartDocument,
): Header<D> {
	return ["Chart", "Chart", (a, b) => CascadingRatingValue(game, chartGetter(a), chartGetter(b))];
}
