import type { NewRawScore } from "tachi-db";

import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type ScoreDocument } from "tachi-common";

/**
 * Maps a hydrated Mongo-shaped score document to a Postgres `score` insert row.
 * `chartIdPg` must be `chart.id` (FK to `chart.id`). The score document's `chartID` may be a legacy id string.
 */
export function mongoScoreDocumentToNewScoreRow(
	score: ScoreDocument,
	chartIdPg: string,
	opts: {
		committed: boolean;
		importId: string | null;
		sessionId: string | null;
	},
): NewRawScore {
	const game = score.game;
	const { data, derived, judgements } = mongoScoreDataToPg(game, score.scoreData);

	return {
		id: score.scoreID,
		user_id: score.userID,
		chart_id: chartIdPg,
		game,
		session_id: opts.sessionId,
		import_id: opts.importId,
		data: JSON.stringify(data),
		derived_data: JSON.stringify(derived),
		judgements: JSON.stringify(judgements),
		calculated_data: JSON.stringify(score.calculatedData),
		meta: JSON.stringify(score.scoreMeta),
		time_achieved:
			score.timeAchieved !== null && score.timeAchieved !== undefined
				? UnixMillisecondsToISO8601(score.timeAchieved)
				: null,
		time_added: UnixMillisecondsToISO8601(score.timeAdded),
		committed: opts.committed,
		highlight: score.highlight,
		comment: score.comment,
	};
}
