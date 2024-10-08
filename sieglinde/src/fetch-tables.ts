/* eslint-disable no-await-in-loop */
import { LoadBMSTable } from "bms-table-loader";
import TableValueGetters from "lookups";
import { BMS_TABLES } from "tachi-common";
import type { BMSTablesDataset } from "./types";
import type { BMSTableEntryMD5 } from "bms-table-loader";
import type { Playtypes } from "tachi-common";

export interface TableRes {
	table: BMSTablesDataset;
	charts: Array<BMSTableEntryMD5>;
}

export default async function GetTableData(
	forPlaytype: Playtypes["bms"]
): Promise<Array<TableRes>> {
	const out = [];

	for (const table of BMS_TABLES.filter(
		(e) => e.name in TableValueGetters && e.playtype === forPlaytype
	)) {
		const bmsTable = await LoadBMSTable(table.url);

		out.push({
			table,
			charts: bmsTable.body
				.filter((e) => e.checksum.type === "md5")
				.map((e) => e.content) as Array<BMSTableEntryMD5>,
		});
	}

	return out;
}
