/**
 * Utilities *specifically* for game/gpt configuration.
 */
import { z } from "zod";

import type { integer } from "../types";
import type { ClassInfo } from "../types/game-config-utils";

export function NoDecimalPlace(value: number): string {
	return value.toFixed(0);
}

/**
 * Mandate that this field formats to this amount of decimal places.
 */
export function ToDecimalPlaces(dp: integer) {
	return (v: number) => v.toFixed(dp);
}

/**
 * Define a value for a class set.
 *
 * @param id - The classes internal string ID.
 * @param display - What should be displayed to end users visually?
 * @param hoverText - If a user hovers over this badge, should it display any different
 * text? This is useful for things like IIDX Dans, where the expected display strings
 * are kanji.
 */
export function ClassValue<V extends string>(
	id: V,
	display: string,
	hoverText?: string,
): ClassInfo<V> {
	return { id, display, hoverText };
}

export const zodTierlistData = z
	.nullable(
		z.strictObject({
			value: z.number(),
			text: z.string(),
			individualDifference: z.boolean(),
		}),
	)
	.optional();

export const zodInt = z.number().int();
export const zodNonNegativeInt = z.number().int().nonnegative();
