import { DeleteUndefinedProps } from "#utils/misc";
import {
	GetGameConfig,
	type integer,
	type MongoDerivedMetrics,
	type MongoOptionalMetrics,
	type MongoProvidedMetrics,
	type PgScoreData,
	type ScoreData,
	type V3Game,
} from "tachi-common";

interface RetVal<TGame extends V3Game = V3Game> {
	derived: MongoDerivedMetrics[TGame];
	data: MongoOptionalMetrics[TGame] & MongoProvidedMetrics[TGame];
}

/**
 * For every key in `obj` whose corresponding metric definition is an ENUM,
 * replace the string value with its integer ordinal (index in `values`).
 * Non-enum fields and non-string values pass through unchanged.
 */
function applyOrdinals(
	obj: Record<string, unknown>,
	metricDefs: Record<string, { type: string; values?: Array<string> }>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		const def = metricDefs[key];

		if (def?.type === "ENUM" && typeof value === "string") {
			result[key] = def.values!.indexOf(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

function splitScoreData<TGame extends V3Game = V3Game>(
	game: TGame,
	sd: ScoreData<TGame>,
): RetVal<TGame> {
	const config = GetGameConfig(game);

	const scoreData = sd as any;

	const eventualOut: any = {
		data: {},
		derived: {},
		judgements: scoreData.judgements,
	};

	for (const [key, value] of Object.entries(config.providedMetrics)) {
		if (value.type === "ENUM") {
			eventualOut.data[key] = value.values.indexOf(scoreData[key]);
		} else {
			eventualOut.data[key] = scoreData[key];
		}
	}

	for (const [key, value] of Object.entries(config.derivedMetrics)) {
		if (value.type === "ENUM") {
			eventualOut.derived[key] = value.values.indexOf(scoreData[key]);
		} else {
			eventualOut.derived[key] = scoreData[key];
		}
	}

	for (const [key, value] of Object.entries(config.optionalMetrics)) {
		if (value.type === "ENUM") {
			eventualOut.data[key] = value.values.indexOf(scoreData.optional[key]);
		} else {
			eventualOut.data[key] = scoreData.optional[key];
		}
	}

	return eventualOut;
}

export function mongoScoreDataToPg<TGame extends V3Game = V3Game>(
	game: TGame,
	scoreData: ScoreData<TGame>,
): PgScoreData<TGame> {
	const { data, derived } = splitScoreData(game, scoreData);

	const config = GetGameConfig(game);

	return {
		data: applyOrdinals(data, config.providedMetrics as any) as any,
		derived: applyOrdinals(derived, config.derivedMetrics as any) as any,
		judgements: scoreData.judgements,
	};
}

/**
 * Reconstruct API {@link ScoreData} from Postgres `data` / `derived_data` JSON blobs
 * and the `judgements` column (the inverse of {@link mongoScoreDataToPg}).
 */
export function pgScoreDataToAPI<TGame extends V3Game = V3Game>(
	game: TGame,
	scoreData: PgScoreData<TGame>,
): ScoreData<TGame> {
	const data = scoreData.data as any;
	const derived = scoreData.derived as any;

	const config = GetGameConfig(game);

	const eventualOut: any = {
		enumIndexes: {},
		optional: {
			enumIndexes: {},
		},
		judgements: scoreData.judgements,
	};

	for (const [key, value] of Object.entries(config.providedMetrics)) {
		if (value.type === "ENUM") {
			const index: integer = data[key];
			eventualOut[key] = value.values[index];
			eventualOut.enumIndexes[key] = index;
		} else {
			eventualOut[key] = data[key];
		}
	}

	for (const [key, value] of Object.entries(config.derivedMetrics)) {
		if (value.type === "ENUM") {
			const index: integer = derived[key];
			eventualOut[key] = value.values[index];
			eventualOut.enumIndexes[key] = index;
		} else {
			eventualOut[key] = derived[key];
		}
	}

	for (const [key, value] of Object.entries(config.optionalMetrics)) {
		if (value.type === "ENUM") {
			const index: integer = data[key];
			eventualOut.optional[key] = value.values[index];
			eventualOut.optional.enumIndexes[key] = index;
		} else {
			eventualOut.optional[key] = data[key];
		}
	}

	DeleteUndefinedProps(eventualOut.optional);
	DeleteUndefinedProps(eventualOut);

	return eventualOut as any;
}
