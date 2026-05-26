import type { KtLogger } from "#lib/log/log";
import type { Classes, integer, V3Game } from "tachi-common";

// type RecordClassProvider<GPT extends GPTString> = {
// 	[C in keyof ClassConfigs[GPT] as ClassConfigs[GPT][C] extends ProvidedClassConfig
// 		? C
// 		: never]: ClassConfigs[GPT][C] extends ProvidedClassConfig<infer V> ? V : never;
// };

// couldn't figure out how to get this typesafe, sorry.
type PartialClassProviderRecord<TGame extends V3Game> = Partial<
	Record<Classes[TGame], string | null | undefined>
>;

export type ClassProvider<TGame extends V3Game> = (
	game: TGame,
	userID: integer,
	ratings: Record<string, number | null>,
	log: KtLogger,
) => PartialClassProviderRecord<TGame> | Promise<PartialClassProviderRecord<TGame>> | undefined;
