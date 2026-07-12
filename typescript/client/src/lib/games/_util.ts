import { type GameRatingSystem } from "#lib/types";
import { type CSSProperties } from "react";
import { type V3Game } from "tachi-common";

export function CreateRatingSys<TGame extends V3Game>(
	name: string,
	description: string,
	enumName: string,
	toNumber: GameRatingSystem<TGame>["toNumber"],
	toString: GameRatingSystem<TGame>["toString"],
	idvDifference: GameRatingSystem<TGame>["idvDifference"] = () => false,
	achievementFn: GameRatingSystem<TGame>["achievementFn"] = undefined,
): GameRatingSystem<TGame> {
	return {
		description,
		enumName,
		name,
		toNumber,
		toString,
		idvDifference,
		achievementFn,
	};
}

export function bg(bgColour: string): CSSProperties {
	return { backgroundColor: bgColour };
}

export function bgc(bgColour: string, colour: string): CSSProperties {
	return { backgroundColor: bgColour, color: colour };
}

export const RAINBOW_GRADIENT = {
	background:
		"linear-gradient(-45deg, #f0788a, #f48fb1, #9174c2, #79bcf2, #70a173, #f7ff99, #faca7d, #ff9d80, #f0788a)",
	color: "var(--bs-dark)",
} as const;

export const RAINBOW_EX_GRADIENT = {
	background: "linear-gradient(-45deg, #0fa091, #0f98d5, #67087f, #d9007e, #f56e06)",
	color: "var(--bs-light)",
} as const;
