import { IsValidGame, type PBScoreDocument, type ScoreDocument, type V3Game } from "tachi-common";

export function IsSupportedGame(str: string): str is V3Game {
	return IsValidGame(str);
}

export function IsScore<TGame extends V3Game>(
	pbOrScore: PBScoreDocument<TGame> | ScoreDocument<TGame>,
): pbOrScore is ScoreDocument<TGame> {
	// @ts-expect-error thats the test...
	return !!pbOrScore.scoreMeta;
}
