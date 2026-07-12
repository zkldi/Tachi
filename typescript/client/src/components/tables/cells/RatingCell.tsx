import { FormatScoreRating } from "#util/misc";
import { type PBScoreDocument, type ScoreDocument } from "tachi-common";

export default function RatingCell({
	score,
	rating,
}: {
	rating: keyof ScoreDocument["calculatedData"];
	score: PBScoreDocument | ScoreDocument;
}) {
	const value = score.calculatedData[rating];
	const game = score.game;

	return <td>{FormatScoreRating(game, rating, value)}</td>;
}
