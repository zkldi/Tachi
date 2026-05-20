import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import { type CellsRenderFN } from "#types/seeds";
import { StrSOV } from "#util/sorts";
import { type SearchFunctions } from "#util/ztable/search";
import React from "react";
import { Badge } from "react-bootstrap";
import { type FolderDocument, FormatGame } from "tachi-common";

import { type Header } from "../components/TachiTable";

/** v3 `folders.json` omits `type`; infer from SQL body when needed. */
function folderSeedKindLabel(x: FolderDocument): string {
	const ext = x as unknown as { type?: string; where?: string };

	if (typeof ext.type === "string") {
		return ext.type;
	}

	const w = ext.where ?? "";

	if (w.includes("s.data")) {
		return "songs";
	}

	return "charts";
}

export const SeedsFolderHeaders: Header<FolderDocument>[] = [
	["ID", "ID", StrSOV((x) => x.folderID)],
	["Name", "Name", StrSOV((x) => x.title)],
	["GPT", "GPT", StrSOV((x) => x.game)],
	["Query", "Query", StrSOV((x) => x.title)],
];

export const SeedsFolderSearchFns: SearchFunctions<FolderDocument> = {
	title: (x) => x.title,
	folderID: (x) => x.folderID,
	inactive: (x) => x.inactive,
	game: (x) => x.game,
	gpt: (x) => FormatGame(x.game),
	type: (x) => folderSeedKindLabel(x),
	query: (x) => {
		const w = (x as { where?: string }).where;

		return typeof w === "string" ? w : "";
	},
};

export const SeedsFolderCells: CellsRenderFN<FolderDocument> = ({
	data,
}: {
	data: FolderDocument;
}) => {
	const whereSql = (data as unknown as { where?: string }).where;
	const showWhere = typeof whereSql === "string" && whereSql.length > 0;

	return (
		<>
			<td>
				<code>{data.folderID}</code>
			</td>
			<td>
				<strong>{data.title}</strong>
				{data.searchTerms && data.searchTerms.length !== 0 && (
					<>
						<br />
						<Muted>{data.searchTerms.join(", ")}</Muted>
					</>
				)}
				{data.inactive && (
					<>
						<br />
						<Badge bg="warning">INACTIVE</Badge>
					</>
				)}
			</td>
			<td>{FormatGame(data.game)}</td>
			<td>
				TYPE: <b>{folderSeedKindLabel(data)}</b>
				<Divider />
				<div className="text-start">
					{showWhere && <code className="text-break">{whereSql}</code>}
				</div>
			</td>
		</>
	);
};
