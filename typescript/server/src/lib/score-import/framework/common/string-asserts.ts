import { type Difficulties, FormatGame, GetGameConfig, type V3Game } from "tachi-common";

import { InvalidScoreFailure } from "./converter-failures";

export function AssertStrAsDifficulty(strVal: string, game: V3Game): Difficulties[V3Game] {
	const diffConf = GetGameConfig(game).difficulties;

	if (diffConf.type === "DYNAMIC") {
		// lol
		return strVal;
	}

	if (!diffConf.order.includes(strVal)) {
		throw new InvalidScoreFailure(
			`Invalid Difficulty for ${FormatGame(game)} - Expected any of ${diffConf.order.join(
				", ",
			)} (Got ${strVal})`,
		);
	}

	if (game === "ongeki" && strVal === "Re:MASTER") {
		throw new InvalidScoreFailure(
			`Invalid Difficulty for ${FormatGame(game)} - Don't use Re:MASTER directly; send the score as LUNATIC instead.`,
		);
	}

	return strVal;
}

const isIntegerRegex = /^-?\d+$/u;

export function AssertStrAsPositiveInt(strVal: string, errorMessage: string) {
	const isInt = isIntegerRegex.test(strVal);

	if (!isInt) {
		throw new InvalidScoreFailure(`${errorMessage} (Not an integer -- ${strVal}.)`);
	}

	const val = Number(strVal);

	if (!Number.isSafeInteger(val)) {
		throw new InvalidScoreFailure(`${errorMessage} (Not an integer -- ${strVal}.)`);
	} else if (val < 0) {
		throw new InvalidScoreFailure(`${errorMessage} (Was negative -- ${strVal}.)`);
	}

	return val;
}

export function AssertStrAsPositiveNonZeroInt(strVal: string, errorMessage: string) {
	const isInt = isIntegerRegex.test(strVal);

	if (!isInt) {
		throw new InvalidScoreFailure(`${errorMessage} (Not an integer -- ${strVal}.)`);
	}

	const val = Number(strVal);

	if (!Number.isSafeInteger(val)) {
		throw new InvalidScoreFailure(`${errorMessage} (Not an integer -- ${val}.)`);
	} else if (val <= 0) {
		throw new InvalidScoreFailure(`${errorMessage} (Was negative or zero -- ${val}.)`);
	}

	return val;
}
