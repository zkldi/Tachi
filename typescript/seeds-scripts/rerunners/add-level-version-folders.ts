import {
	CreateTableID,
	FormatGame,
	SEEDS_FolderDocument,
	SEEDS_TableDocument,
	V3Game,
} from "tachi-common";
import { CreateFolderID, CreateRandomLegacyFolderID, MutateCollection } from "../util.js";

export default function AddLevelVersionFolders(
	name: string,
	shortName: string,
	game: V3Game,
	version: string,
	levels: string[],
) {
	const slugs: string[] = [];

	MutateCollection("folders.json", (foldersCol: SEEDS_FolderDocument[]) => {
		for (const level of levels) {
			const slug = `${level}-${shortName}`;
			const folder: SEEDS_FolderDocument = {
				game,
				id: CreateFolderID(),
				inactive: false,
				legacyFolderID: CreateRandomLegacyFolderID(),
				searchTerms: [],
				slug,
				title: `Level ${level} (${name})`,
				versionFilter: [version],
				where: `chart.level = '${level}'`,
			};

			slugs.push(slug);
			foldersCol.push(folder);
		}

		return foldersCol;
	});

	MutateCollection("tables.json", (tables: SEEDS_TableDocument[]) => {
		tables.push({
			default: false,
			description: `Levels for ${FormatGame(game)} in ${name}.`,
			folders: slugs,
			game,
			inactive: false,
			id: CreateTableID(),
			legacyTableID: `${game}-${shortName}-levels`,
			title: `${FormatGame(game)} (${name})`,
		});

		return tables;
	});
}

// usage:

// const levels = [];
// for (let i = 1; i <= 12; i++) {
// 	levels.push(i.toString())
// }
//
// AddLevelVersionFolders("CastHour", "casthour", "iidx-sp", "29", levels);
