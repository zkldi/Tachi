import type { CGServices, CGSupportedGames } from "./types";
import type { Game } from "tachi-common";

export function CGGameToTachiGame(cgGame: CGSupportedGames): Game {
	switch (cgGame) {
		case "jb":
			return "jubeat";
		case "msc":
			return "museca";
		case "iidx":
		case "popn":
		case "sdvx":
			return cgGame;
	}
}

export function FormatCGService(cgService: CGServices) {
	return cgService === "dev" ? "CG Dev" : "CG";
}
