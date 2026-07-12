import type { GameGroup } from "tachi-common";

import type { CGServices, CGSupportedGames } from "./types";

export function CGGameToTachiGame(cgGame: CGSupportedGames): GameGroup {
	switch (cgGame) {
		case "jb":
			return "jubeat";
		case "msc":
			return "museca";
		case "popn":
		case "sdvx":
			return cgGame;
	}
}

export function FormatCGService(cgService: CGServices) {
	return cgService === "dev" ? "CG Dev" : "CG";
}
