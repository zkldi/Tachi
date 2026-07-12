import { GetGameConfig, GetScoreMetricConf, type V3Game } from "tachi-common";

export function HumanFriendlyStrToEnumIndex(game: V3Game, enumMetric: string) {
	const gameConfig = GetGameConfig(game);

	const conf = GetScoreMetricConf(gameConfig, enumMetric);

	if (conf?.type !== "ENUM") {
		return () => 0; // wut
	}

	const lowerValues = conf.values.map((e) => e.toLowerCase());

	return (str: string) => {
		const lowerStr = str.toLowerCase();
		let partialMatch: number | null = null;

		for (let i = 0; i < conf.values.length; i++) {
			const value = lowerValues[i];

			if (value === lowerStr) {
				return i;
			}

			if (value.startsWith(lowerStr) && partialMatch === null) {
				partialMatch = i;
			}
		}

		return partialMatch;
	};
}
