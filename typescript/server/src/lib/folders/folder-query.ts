import type { Database } from "tachi-db";

import { log } from "#lib/log/log";
import { type Kysely, sql } from "kysely";

/**
 * Folder membership SQL (see tests in `folders.test.ts`).
 * Does not import the global `DB` module - safe for scripts that only set `POSTGRES_URL`.
 */
export async function BuildFolderQuery(folderID: string, db: Kysely<Database>) {
	const folder = await db
		.selectFrom("folder")
		.select(["folder.game", "folder.where", "folder.version_filter"])
		.where("folder.id", "=", folderID)
		.executeTakeFirst();

	if (!folder) {
		throw new Error(`Folder with ID '${folderID}' not found.`);
	}

	// Parentheses: `folder.where` is spliced before ANDs on chart.game / versions; without
	// them, `A OR B AND chart.game = …` parses as `A OR (B AND …)` instead of `(A OR B) AND …`.
	const interpolateWhereRaw = sql.raw(`(${folder.where})`);

	// JOIN song so predicates can use `song.` (song-type folders from `5-folders-to-sql-queries.ts`).
	if (folder.version_filter) {
		const vf = folder.version_filter;

		return {
			folderQuery: sql`
				SELECT
					chart.id
				FROM
					chart
					INNER JOIN
						song
						ON song.id = chart.song_id
				WHERE
					${interpolateWhereRaw}
					AND chart.game = ${folder.game}

				AND chart.versions && ARRAY[${sql.join(vf.map((v) => sql`${v}`))}]::text[]
			`,
		};
	}

	return {
		folderQuery: sql`
			SELECT
				chart.id
			FROM
				chart
				INNER JOIN
					song
					ON song.id = chart.song_id
			WHERE
				${interpolateWhereRaw}
				AND chart.game = ${folder.game}
		`,
	};
}

/**
 * Chart IDs for a folder from the denormalized `folder_chart_lookup` table.
 * Run {@link rebuildFolderChartLookup} (or nightly job) to keep rows in sync with `folder.where`.
 */
export async function GetFolderChartIDs(folderID: string, db: Kysely<Database>) {
	const rows = await db
		.selectFrom("folder_chart_lookup")
		.select("folder_chart_lookup.chart_id")
		.where("folder_chart_lookup.folder_id", "=", folderID)
		.orderBy("folder_chart_lookup.chart_id asc")
		.execute();

	return rows.map((r) => r.chart_id);
}

/**
 * Evaluates `folder.where` SQL (same as a full rebuild). Used by
 * {@link rebuildFolderChartLookup}; do not call for normal reads - use {@link GetFolderChartIDs}.
 */
export async function computeFolderChartIdsFromFolderSql(folderID: string, db: Kysely<Database>) {
	const { folderQuery } = await BuildFolderQuery(folderID, db);

	try {
		const res = await folderQuery.execute(db);
		const rows = res.rows as Array<{ id: string }>;

		return rows.map((e) => e.id);
	} catch (err) {
		let compiledSql: string | undefined;
		let compiledParameters: unknown[] | undefined;
		try {
			const compiled = folderQuery.compile(db);
			compiledSql = compiled.sql;
			compiledParameters = Array.from(compiled.parameters);
		} catch (compileErr) {
			log.error(
				{ err, compileErr, folderId: folderID },
				"computeFolderChartIdsFromFolderSql: failed while compiling query for error logging",
			);
		}

		log.error(
			{ err, folderId: folderID, sql: compiledSql, parameters: compiledParameters },
			"computeFolderChartIdsFromFolderSql: folder chart SQL failed (e.g. during folder_chart_lookup rebuild)",
		);

		throw err;
	}
}
