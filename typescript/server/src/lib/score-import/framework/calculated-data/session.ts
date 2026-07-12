import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { type ScoreDocument, type V3Game } from "tachi-common";

/**
 * Create calculated data for a session of this game and playtype.
 * @param scores - All of the scores in this session.
 */
export function CreateSessionCalcData(game: V3Game, scores: Array<ScoreDocument>) {
	return GAME_IMPLEMENTATIONS[game].sessionCalcs(scores.map((e) => e.calculatedData));
}
