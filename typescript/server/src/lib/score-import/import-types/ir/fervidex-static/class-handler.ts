import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";
import type { GamesForGroup, integer } from "tachi-common";

import { staticAssertUnreachable } from "#utils/misc";
import { IIDXDans } from "tachi-common/config/game-support/iidx";

export function CreateFerStaticClassProvider(
	body: Record<string, unknown>,
): ClassProvider<GamesForGroup["iidx"]> {
	return (game, _userID, _ratings, log) => {
		let index;

		switch (game) {
			case "iidx-sp":
				index = body.sp_dan;
				break;
			case "iidx-dp":
				index = body.dp_dan;
				break;
			default:
				staticAssertUnreachable(game);
		}

		if (index === undefined) {
			return;
		}

		if (!Number.isInteger(index)) {
			log.info({ body }, `received invalid fer-static class of ${index} (${game}).`);
			return;
		}

		const dan = IIDXDans[index as integer];

		if (!dan) {
			log.warn(`Invalid fer-static class of ${index}. Skipping.`);
			return;
		}

		return {
			dan: dan.id,
		};
	};
}
