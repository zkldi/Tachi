import { pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type GameGroup, type ImportTypes, type ScoreDocument } from "tachi-common";
import { type Game } from "tachi-db";

/** Columns from `score` joined with chart/song for a full {@link ScoreDocument}. */
export const SELECT_SCORE_DOCUMENT = [
	"score.id as score_id",
	"score.user_id as score_user_id",
	"score.game as score_game",
	"score.data as score_data",
	"score.derived_data as score_derived_data",
	"score.judgements as score_judgements",
	"score.calculated_data as score_calculated_data",
	"score.meta as score_meta",
	"score.time_achieved as score_time_achieved",
	"score.time_added as score_time_added",
	"score.session_id as score_session_id",
	"score.highlight as score_highlight",
	"score.comment as score_comment",
	"chart.id as chart_id",
	"chart.is_primary as chart_is_primary",
	"song.id as song_id",
	"import.service as import_service",
	"import.import_type as import_import_type",
] as const;

/** Row shape from {@link SELECT_SCORE_DOCUMENT} join query. */
export interface ScoreDocumentJoinRow {
	score_id: string;
	score_user_id: number;
	score_game: Game;
	score_data: unknown;
	score_derived_data: unknown;
	score_judgements: unknown;
	score_calculated_data: unknown;
	score_meta: unknown;
	score_time_achieved: string | null;
	score_time_added: string;
	score_session_id: string | null;
	score_highlight: boolean;
	score_comment: string | null;
	chart_id: string;
	chart_is_primary: boolean;
	song_id: string;
	import_service: string | null;
	import_import_type: string | null;
}

export function ToScoreDocument(row: ScoreDocumentJoinRow): ScoreDocument {
	const scoreData = pgScoreDataToAPI(row.score_game, {
		data: row.score_data as any,
		derived: row.score_derived_data as any,
		judgements: row.score_judgements as any,
	});

	const scoreMeta = row.score_meta as ScoreDocument["scoreMeta"];

	const calculatedData = row.score_calculated_data as ScoreDocument["calculatedData"];

	const service =
		row.import_service !== null &&
		row.import_service !== undefined &&
		row.import_service.length > 0
			? row.import_service
			: "Unknown";

	return {
		// todo(?)
		service,
		game: row.score_game,
		userID: row.score_user_id,
		scoreData,
		scoreMeta: scoreMeta ?? {},
		calculatedData: calculatedData ?? {},
		timeAchieved: row.score_time_achieved
			? ISO8601ToUnixMilliseconds(row.score_time_achieved)
			: null,
		songID: row.song_id,
		chartID: row.chart_id,
		isPrimary: row.chart_is_primary,
		highlight: row.score_highlight,
		comment: row.score_comment,
		timeAdded: ISO8601ToUnixMilliseconds(row.score_time_added),
		scoreID: row.score_id,
		sessionID: row.score_session_id,
		importType: row.import_import_type as ImportTypes | null,
	};
}

export async function LoadScoreDocumentById(scoreID: string): Promise<ScoreDocument | undefined> {
	const row = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.id", "=", scoreID)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	return ToScoreDocument(row as ScoreDocumentJoinRow);
}

/** All scores linked to a Postgres `import.id` (`score.import_id`). */
export async function LoadScoreDocumentsForImport(importId: string): Promise<Array<ScoreDocument>> {
	const rows = await DB.selectFrom("raw_score as score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.import_id", "=", importId)
		.execute();

	return rows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
}

/**
 * Loads all committed score documents for a chart.
 */
export async function LoadScoreDocumentsByChartKeyAndGameGroup(
	game: GameGroup,
	chartID: string,
): Promise<Array<ScoreDocument>> {
	const rows = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("song.game_group", "=", game)
		.where("chart.id", "=", chartID)
		.where("score.committed", "=", true)
		.execute();

	return rows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
}
