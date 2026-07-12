import { FormatGame } from "../../common/src/index.ts";

import { CreateFolderID, MutateCollection } from "../util.js";

export default function AddLevelVersionFolders(name, game, playtypes, version, levels) {
	const ptFolders = {};

	MutateCollection("folders.json", (folders) => {
		for (const level of levels) {
			const folder = {
				data: {
					level,
					versions: version,
				},
				game,
				inactive: false,
				searchTerms: [],
				title: `Level ${level} (${name})`,
				type: "charts",
			};

			for (const playtype of playtypes) {
				const folderID = CreateFolderID(folder.data, folder.game, playtype);

				const realFolder = Object.assign({ folderID, playtype }, folder);

				if (ptFolders[playtype]) {
					ptFolders[playtype].push(realFolder);
				} else {
					ptFolders[playtype] = [realFolder];
				}

				folders.push(realFolder);
			}
		}

		return folders;
	});

	MutateCollection("tables.json", (tables) => {
		for (const playtype of playtypes) {
			tables.push({
				default: false,
				description: `Levels for ${FormatGame(game, playtype)} in ${name}.`,
				folders: ptFolders[playtype].map((e) => e.folderID),
				game,
				inactive: false,
				playtype,
				tableID: `${game}-${playtype}-${version}-levels`,
				title: `${FormatGame(game, playtype)} (${name})`,
			});
		}

		return tables;
	});
}

// usage:

// const levels = [];
// for (let i = 1; i <= 12; i++) {
// 	levels.push(i.toString())
// }
//
// AddLevelVersionFolders("CastHour", "iidx", ["SP", "DP"], "29", levels);
