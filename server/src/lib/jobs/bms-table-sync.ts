/* eslint-disable no-await-in-loop */
import { LoadBMSTable } from "bms-table-loader";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { DeorphanIfInQueue } from "lib/orphan-queue/orphan-queue";
import { BMS_TABLES } from "tachi-common";
import { InitaliseFolderChartLookup } from "utils/folder";
import { FormatBMSTables, WrapScriptPromise } from "utils/misc";
import type { BMSTableEntry } from "bms-table-loader";
import type { FilterQuery } from "mongodb";
import type { BMSTableInfo, ChartDocument, Playtypes } from "tachi-common";

const logger = CreateLogCtx(__filename);

/**
 * Tables might have updates that remove charts from their table.
 *
 * We need to handle this -- infact, it's quite common for something
 * to go from the sl12 folder to st0 -- which is a cross-table
 * change.
 */
async function HandleTableRemovals(
	tableEntries: Array<BMSTableEntry>,
	playtype: Playtypes["bms"],
	prefix: string
) {
	if (tableEntries.length === 0) {
		logger.info(
			`No entries in table ${prefix}, skipping removals to prevent instantly wiping the table.`
		);
		return;
	}

	// There are two ways to approach this, we could wipe the table
	// and then just apply the update. That is easy enough, but
	// leaves us in a temporary* invalid state for a while.

	// *unless this script crashes, in which case it's
	// no longer temporary
	const existingCharts = (await db.charts.bms.find({
		playtype,
		"data.tableFolders.table": prefix,
	})) as unknown as Array<ChartDocument<"bms:7K" | "bms:14K">>;

	logger.info(
		`Found ${existingCharts.length} existing chart(s) in the database for table ${prefix}.`
	);

	// As such, the easiest way to handle this is to disjoint
	// the current md5s in the table against the md5s in the new
	// table. If the existing md5set doesn't exist in the new
	// table, we need to pull it.

	const newTableMD5s = new Set();
	const newTableSHA256s = new Set();

	for (const entry of tableEntries) {
		switch (entry.checksum.type) {
			case "md5": {
				newTableMD5s.add(entry.checksum.value);
				break;
			}

			case "sha256":
				newTableSHA256s.add(entry.checksum.value);
		}
	}

	const toRemove: Array<string> = [];

	for (const chart of existingCharts) {
		if (newTableMD5s.has(chart.data.hashMD5)) {
			continue;
		}

		if (newTableSHA256s.has(chart.data.hashSHA256)) {
			continue;
		}

		toRemove.push(chart.chartID);
	}

	if (toRemove.length === 0) {
		return;
	}

	logger.info(`Removing ${toRemove.length} chart(s) from ${prefix}.`);

	// remove this table info from all of the charts that no longer
	// exist in the table.
	await db.charts.bms.update(
		{
			chartID: { $in: toRemove },
		},
		{
			$pull: {
				"data.tableFolders": { table: prefix },
			},
		},
		{ multi: true }
	);
}

async function ImportTableLevels(
	tableEntries: Array<BMSTableEntry>,
	prefix: string,
	playtype: Playtypes["bms"]
) {
	let failures = 0;
	let success = 0;
	const total = tableEntries.length;

	logger.info(`Handling removals for ${playtype}:${prefix}...`);
	await HandleTableRemovals(tableEntries, playtype, prefix);

	const md5s = tableEntries.filter((e) => e.checksum.type === "md5").map((e) => e.checksum.value);
	const sha256s = tableEntries
		.filter((e) => e.checksum.type === "md5")
		.map((e) => e.checksum.value);

	await db.charts.bms.update(
		{
			"data.hashMD5": { $in: md5s },
		},
		{
			$pull: {
				"data.tableFolders": { table: prefix },
			},
		},
		{ multi: true }
	);

	await db.charts.bms.update(
		{
			"data.hashSHA256": { $in: sha256s },
		},
		{
			$pull: {
				"data.tableFolders": { table: prefix },
			},
		},
		{ multi: true }
	);

	for (const td of tableEntries) {
		let query: FilterQuery<ChartDocument<"bms:7K" | "bms:14K">>;

		switch (td.checksum.type) {
			case "md5": {
				query = { "data.hashMD5": td.checksum.value };
				break;
			}

			case "sha256": {
				query = { "data.hashSHA256": td.checksum.value };
				break;
			}
		}

		let chart: ChartDocument<"bms:7K" | "bms:14K"> | null = await db.charts.bms.findOne(query);

		if (!chart) {
			// didn't find it in the DB?
			// try and find it in the BMS orphan-queue

			switch (td.checksum.type) {
				case "md5": {
					chart = await DeorphanIfInQueue(`bms:${playtype}`, "bms", {
						"chartDoc.data.hashMD5": td.checksum.value,
					});
					break;
				}

				case "sha256":
					chart = await DeorphanIfInQueue(`bms:${playtype}`, "bms", {
						"chartDoc.data.hashSHA256": td.checksum.value,
					});
			}

			if (!chart) {
				logger.warn(
					`No chart exists in table for (${td.checksum.type}=${td.checksum.value} Possible title: ${td.content.title} ${prefix}${td.content.level}`
				);
				failures++;
				continue;
			}
		}

		const tableFolders = chart.data.tableFolders.filter((e) => e.table !== prefix);

		tableFolders.push({ table: prefix, level: td.content.level.toString() });

		tableFolders.sort((a, b) => {
			if (a.table !== b.table) {
				return a.table.localeCompare(b.table);
			}

			return a.level.localeCompare(b.level);
		});

		await db.charts.bms.update(
			{
				chartID: chart.chartID,
			},
			{
				$set: {
					"data.tableFolders": tableFolders,
				},
			}
		);

		await db.songs.bms.update(
			{
				id: chart.songID,
			},
			{
				$set: {
					"data.tableString": FormatBMSTables(tableFolders),
				},
			}
		);

		success++;
	}

	logger.info(`Finished updating table ${prefix}.`);
	logger.info(`${success} Success | ${failures} Failures | ${total} Total.`);
}

export async function UpdateTable(tableInfo: BMSTableInfo) {
	const table = await LoadBMSTable(tableInfo.url);

	logger.info(`Bumping levels...`);
	await ImportTableLevels(table.body, tableInfo.prefix, tableInfo.playtype);
	logger.info(`Levels bumped.`);
}

export async function SyncBMSTables() {
	for (const table of BMS_TABLES) {
		try {
			// eslint-disable-next-line no-await-in-loop
			await UpdateTable(table);
		} catch (err) {
			logger.error(`Failed to update table ${table.name} (${table.url}).`, { err });
		}
	}

	logger.info(`Re-initialising folder-chart-lookup, since changes may have been made.`);
	await InitaliseFolderChartLookup();
	logger.info(`Done.`);
}

if (require.main === module) {
	WrapScriptPromise(SyncBMSTables(), logger);
}
