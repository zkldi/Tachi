import type { GameGroup } from "tachi-common";

import type { MytGame } from "./types";

export function GameToMytGame(game: GameGroup): MytGame | undefined {
	switch (game) {
		case "chunithm":
			return "chunithm";
		case "maimaidx":
			return "maimai";
		case "ongeki":
			return "ongeki";
		case "wacca":
			return "wacca";
		default:
			return undefined;
	}
}
