import { rebuildFolderChartLookup } from "#lib/folders/rebuild-folder-chart-lookup";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";

/** Nightly (or cron) full rebuild of `folder_chart_lookup`. */
export async function RebuildFolderChartLookupJob() {
	log.info("Starting RebuildFolderChartLookup job.");

	const result = await rebuildFolderChartLookup(DB);

	log.info(
		`RebuildFolderChartLookup done: ${result.folderCount} folders, ${result.rowCount} lookup rows.`,
	);
}
