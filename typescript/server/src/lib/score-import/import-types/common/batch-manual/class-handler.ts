import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ClassToIndex } from "#utils/class";
import { type Classes, GetGameConfig, type V3Game } from "tachi-common";

export type CreateBatchManualClassProviderOptions = {
	/**
	 * When true (`file/import-class` only), the classes you give ARE the classes you get.
	 * When false (`file/batch-manual`, `ir/direct-manual`), the classes you give are what you get if and only if they are improvements
	 */
	replaceBetterClassesWithIncoming?: boolean;
};

// Note: This is tested by batch-manuals parser.test.ts.
export function CreateBatchManualClassProvider(
	outerGame: V3Game,
	classes: Partial<Record<Classes[V3Game], string | null>>,
	options?: CreateBatchManualClassProviderOptions,
): ClassProvider<V3Game> {
	const nullClearsProvidedClass = options?.replaceBetterClassesWithIncoming === true;

	return (game, _userID, _ratings, log) => {
		if (outerGame !== game) {
			return {};
		}

		const gameConfig = GetGameConfig(game);
		const newObj: Partial<Record<Classes[V3Game], string | null>> = {};

		for (const [sk, rawId] of Object.entries(classes)) {
			if (rawId === null) {
				if (nullClearsProvidedClass) {
					newObj[sk as Classes[V3Game]] = null;
				}
				continue;
			}

			const ck = sk as Classes[V3Game];

			const index = ClassToIndex(game, ck, rawId);

			if (index === null) {
				const allowedJoin = gameConfig.classes[ck]!.values.map((e) => e.id).join(", ");

				log.warn(
					`User passed invalid class of ${rawId} for set ${sk}. Expected any of ${allowedJoin}`,
				);

				throw new ScoreImportFatalError(
					400,
					`Invalid class of ${rawId} for set ${sk}. Expected any of ${allowedJoin}`,
				);
			}

			newObj[ck] = rawId;
		}

		return newObj;
	};
}
