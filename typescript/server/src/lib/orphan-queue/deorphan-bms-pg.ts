import { GetChartByIdForGame } from "#lib/db-formats/chart";
import { log } from "#lib/log/log";
import { LEGACY_CHART_ID_LENGTH } from "#lib/score-import/framework/score-importing/score-id";
import DB from "#services/pg/db";
import { GetNextBmsPmsSongLegacyId } from "#utils/db";
import { Random20Hex } from "#utils/misc";
import { sql } from "kysely";
import {
	type BMSGames,
	type ChartDocument,
	CreateSongID,
	type GameGroupFromGame,
	type SongDocument,
} from "tachi-common";

/**
 * Forcefully de-orphan a BMS song/chart from `orphan_chart` when it matches a hash,
 * inserting into `song` / `chart` in Postgres. Used by BMS table sync (and tests).
 */
export async function DeorphanBmsIfInOrphanChartPg(
	game: BMSGames,
	checksumType: "md5" | "sha256",
	value: string,
): Promise<ChartDocument<BMSGames> | null> {
	const hashMatch =
		checksumType === "md5"
			? sql<boolean>`(orphan_chart.chart_doc::jsonb->'data'->>'hashMD5') = ${value}`
			: sql<boolean>`(orphan_chart.chart_doc::jsonb->'data'->>'hashSHA256') = ${value}`;

	const orphanRow = await DB.selectFrom("orphan_chart")
		.select(["orphan_chart.id", "orphan_chart.chart_doc", "orphan_chart.song_doc"])
		.where("orphan_chart.game", "=", game)
		.where(hashMatch)
		.executeTakeFirst();

	if (!orphanRow) {
		return null;
	}

	const chartDoc = orphanRow.chart_doc as ChartDocument<BMSGames>;
	const songDoc = orphanRow.song_doc as SongDocument<GameGroupFromGame[BMSGames]>;

	log.info(`Song ${songDoc.title} was unorphaned forcefully (Postgres).`);

	const songLegacyId = await GetNextBmsPmsSongLegacyId("bms");
	const songNewID = CreateSongID();

	songDoc.id = songNewID;
	chartDoc.song = songDoc;

	if (chartDoc.legacyChartID?.length !== LEGACY_CHART_ID_LENGTH) {
		chartDoc.legacyChartID = Random20Hex();
	}

	const ftsDocument = [...songDoc.searchTerms, ...songDoc.altTitles].filter(Boolean).join(" ");

	await DB.transaction().execute(async (trx) => {
		await trx
			.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: songLegacyId,
				game_group: "bms",
				title: songDoc.title,
				artist: songDoc.artist,
				search_terms: songDoc.searchTerms,
				alt_titles: songDoc.altTitles,
				fts_document: ftsDocument,
				data: songDoc.data as object,
			})
			.execute();

		await trx
			.insertInto("chart")
			.values({
				id: chartDoc.chartID,
				legacy_id: chartDoc.legacyChartID,
				game,
				song_id: songNewID,
				level: chartDoc.level,
				level_num: chartDoc.levelNum,
				is_primary: chartDoc.isPrimary,
				difficulty: chartDoc.difficulty,
				versions: chartDoc.versions,
				data: chartDoc.data as object,
			})
			.execute();

		await trx
			.deleteFrom("orphan_chart_user")
			.where("orphan_chart_id", "=", orphanRow.id)
			.execute();

		await trx.deleteFrom("orphan_chart").where("id", "=", orphanRow.id).execute();
	});

	const loaded = await GetChartByIdForGame(game, chartDoc.chartID);

	if (!loaded) {
		log.error(`Deorphan succeeded but GetChartById failed for ${chartDoc.chartID}.`);
		return null;
	}

	return loaded as ChartDocument<BMSGames>;
}
