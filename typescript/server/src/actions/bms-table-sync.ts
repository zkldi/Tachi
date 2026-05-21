/* eslint-disable no-await-in-loop */

import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import { DeorphanBmsIfInOrphanChartPg } from "#lib/orphan-queue/deorphan-bms-pg";
import DB from "#services/pg/db";
import { FormatBMSTables } from "#utils/misc";
import { FindBMSChartOnHashInGame } from "#utils/queries/charts";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { type BMSTableEntry, LoadBMSTable } from "bms-table-loader";
import { sql } from "kysely";
import _ from "lodash";
import {
	BMS_TABLES,
	type BMSGames,
	type BMSTableInfo,
	type ChartDocument,
	type ChartDocumentData,
} from "tachi-common";

const UPDATE_CHUNK = 500;

type BmsChartData = ChartDocumentData["bms-7k"];

function stripTableFoldersKeySql(prefix: string) {
	return sql`jsonb_set(
		data::jsonb,
		'{tableFolders}',
		coalesce(data::jsonb->'tableFolders', '{}'::jsonb) - ${prefix}
	)`;
}

/**
 * Tables might have updates that remove charts from their table.
 *
 * We need to handle this -- infact, it's quite common for something
 * to go from the sl12 folder to st0 -- which is a cross-table
 * change.
 */
async function HandleTableRemovals(
	tableEntries: Array<BMSTableEntry>,
	game: BMSGames,
	prefix: string,
) {
	if (tableEntries.length === 0) {
		log.info(
			`No entries in table ${prefix}, skipping removals to prevent instantly wiping the table.`,
		);
		return;
	}

	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(["chart.id as chart_id", "chart.data as chart_data"])
		.where("chart.game", "=", game)
		.where(sql<boolean>`(chart.data::jsonb->'tableFolders') ? ${prefix}`)
		.execute();

	log.info(`Found ${rows.length} existing chart(s) in the database for table ${prefix}.`);

	const newTableMD5s = new Set<string>();
	const newTableSHA256s = new Set<string>();

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

	for (const row of rows) {
		const data = row.chart_data as BmsChartData;
		if (newTableMD5s.has(data.hashMD5)) {
			continue;
		}

		if (newTableSHA256s.has(data.hashSHA256)) {
			continue;
		}

		toRemove.push(row.chart_id);
	}

	if (toRemove.length === 0) {
		return;
	}

	log.info(`Removing ${toRemove.length} chart(s) from ${prefix}.`);

	for (let i = 0; i < toRemove.length; i += UPDATE_CHUNK) {
		const chunk = toRemove.slice(i, i + UPDATE_CHUNK);
		await DB.updateTable("chart")
			.set({ data: stripTableFoldersKeySql(prefix) })
			.where("id", "in", chunk)
			.execute();
	}
}

async function ImportTableLevels(
	tableEntries: Array<BMSTableEntry>,
	prefix: string,
	game: BMSGames,
) {
	let failures = 0;
	let success = 0;
	const total = tableEntries.length;

	log.info(`Handling removals for ${game}:${prefix}...`);
	await HandleTableRemovals(tableEntries, game, prefix);

	const md5s = tableEntries.filter((e) => e.checksum.type === "md5").map((e) => e.checksum.value);
	const sha256s = tableEntries
		.filter((e) => e.checksum.type === "sha256")
		.map((e) => e.checksum.value);

	if (md5s.length > 0) {
		await DB.updateTable("chart")
			.set({ data: stripTableFoldersKeySql(prefix) })
			.where("game", "=", game)
			.where(sql`(data::jsonb->>'hashMD5')::text`, "in", md5s)
			.execute();
	}

	if (sha256s.length > 0) {
		await DB.updateTable("chart")
			.set({ data: stripTableFoldersKeySql(prefix) })
			.where("game", "=", game)
			.where(sql`(data::jsonb->>'hashSHA256')::text`, "in", sha256s)
			.execute();
	}

	for (const td of tableEntries) {
		let chart: ChartDocument<BMSGames> | null = await FindBMSChartOnHashInGame(
			td.checksum.value,
			game,
		);

		if (!chart) {
			chart = await DeorphanBmsIfInOrphanChartPg(
				game,
				td.checksum.type === "md5" ? "md5" : "sha256",
				td.checksum.value,
			);
		}

		if (!chart) {
			log.warn(
				`No chart exists in table for (${td.checksum.type}=${td.checksum.value} Possible title: ${td.content.title} ${prefix}${td.content.level}`,
			);
			failures++;
			continue;
		}

		const tableFolders = _.cloneDeep(chart.data.tableFolders ?? {});
		tableFolders[prefix] = td.content.level.toString();

		const sortedTableFolders = Object.keys(tableFolders)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = tableFolders[key];
					return acc;
				},
				{} as typeof tableFolders,
			);

		Object.assign(tableFolders, sortedTableFolders);

		const mergedChartData = { ...chart.data, tableFolders };

		await DB.updateTable("chart")
			.set({ data: mergedChartData as object })
			.where("id", "=", chart.chartID)
			.execute();

		const tableString = FormatBMSTables(tableFolders);
		await DB.updateTable("song")
			.set({
				data:
					tableString === null
						? sql`jsonb_set(data::jsonb, '{tableString}', 'null'::jsonb)`
						: sql`jsonb_set(data::jsonb, '{tableString}', to_jsonb(${tableString}::text))`,
			})
			.where("song.id", "=", chart.song.id)
			.where("song.game_group", "=", "bms")
			.execute();

		success++;
	}

	log.info(`Finished updating table ${prefix}.`);
	log.info(`${success} Success | ${failures} Failures | ${total} Total.`);
}

export async function UpdateTable(tableInfo: BMSTableInfo) {
	const table = await LoadBMSTable(tableInfo.url);

	if (table.head.symbol !== tableInfo.prefix) {
		throw new Error(
			`Table ${tableInfo.name} (${tableInfo.url}) has unexpected symbol: expected ${JSON.stringify(tableInfo.prefix)}, got ${JSON.stringify(table.head.symbol)}.`,
		);
	}

	log.info(`Bumping levels...`);
	await ImportTableLevels(table.body, tableInfo.prefix, tableInfo.game);
	log.info(`Levels bumped.`);
}

/** Full sync over {@link BMS_TABLES}. */
export async function syncBmsTablesCore() {
	for (const table of BMS_TABLES) {
		try {
			await UpdateTable(table);
		} catch (err) {
			log.error({ err }, `Failed to update table ${table.name} (${table.url}).`);
		}
	}

	log.info(`Re-initialising folder-chart-lookup, since changes may have been made.`);
	// await InitaliseFolderChartLookup();
	log.info(`Done.`);
}

export async function SyncBMSTables() {
	await syncBmsTablesCore();
}

export const ACTION_BMSTableSync = MakeAction("BMS_TABLE_SYNC", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	await syncBmsTablesCore();
	return {};
});
