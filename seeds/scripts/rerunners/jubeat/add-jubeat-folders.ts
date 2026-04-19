/* eslint-disable no-loop-func */
const { MutateCollection, CreateFolderID } = require("../../util");
import { JUBEAT_SINGLE_CONF } from "tachi-common/config/game-support/jubeat";
import { FolderDocument } from "tachi-common/src/types";

function CreateFolder(criteria, title, hardMode) {
	const f: any = {
		game: "jubeat",
		playtype: "Single",
		data: criteria,
		searchTerms: [],
		title,
		type: "charts",
		inactive: false,
	};

	f.data.difficulty = hardMode
		? { "~in": ["HARD BSC", "HARD ADV", "HARD EXT"] }
		: { "~in": ["BSC", "ADV", "EXT"] };

	const folderID = CreateFolderID(f.data, f.game, f.playtype);

	f.folderID = folderID;

	return f;
}

const versions = ["beyond"];

for (const version of versions) {
	const shouldAddDecimals = true;

	const versionPretty = JUBEAT_SINGLE_CONF.versions[version];
	const levelFolders: Array<FolderDocument> = [];
	const levelHardFolders: Array<FolderDocument> = [];

	for (const level of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
		const f = CreateFolder(
			{
				level,
				versions: version,
			},
			`Level ${level} (${versionPretty})`,
			false
		);
		const fh = CreateFolder(
			{
				level,
				versions: version,
			},
			`Level ${level} (Hard Mode) (${versionPretty})`,
			true
		);

		levelFolders.push(f);
		levelHardFolders.push(fh);
	}

	levelFolders.push(
		CreateFolder(
			{ levelNum: { "~gte": 9, "~lt": 10 }, versions: version },
			`Level 9.0-9.9 (${versionPretty})`,
			false
		)
	);
	levelFolders.push(
		CreateFolder(
			{ levelNum: { "~gte": 10, "~lt": 11 }, versions: version },
			`Level 10.0-10.9 (${versionPretty})`,
			false
		)
	);

	levelHardFolders.push(
		CreateFolder(
			{ levelNum: { "~gte": 9, "~lt": 10 }, versions: version },
			`Level 9.0-9.9 (Hard Mode) (${versionPretty})`,
			true
		)
	);
	levelHardFolders.push(
		CreateFolder(
			{ levelNum: { "~gte": 10, "~lt": 11 }, versions: version },
			`Level 10.0-10.9 (Hard Mode) (${versionPretty})`,
			true
		)
	);

	const detailFolders: Array<FolderDocument> = [];
	const detailHardFolders: Array<FolderDocument> = [];

	if (shouldAddDecimals) {
		for (const level of [
			"9.0",
			"9.1",
			"9.2",
			"9.3",
			"9.4",
			"9.5",
			"9.6",
			"9.7",
			"9.8",
			"9.9",
			"10.0",
			"10.1",
			"10.2",
			"10.3",
			"10.4",
			"10.5",
			"10.6",
			"10.7",
			"10.8",
			"10.9",
		]) {
			const f = CreateFolder(
				{ level, versions: version },
				`Level ${level} (${versionPretty})`,
				false
			);
			const fh = CreateFolder(
				{ level, versions: version },
				`Level ${level} (Hard Mode) (${versionPretty})`,
				true
			);

			detailFolders.push(f);
			detailHardFolders.push(fh);
		}
	}

	MutateCollection("folders.json", (folders) => {
		folders.push(...levelFolders);
		folders.push(...levelHardFolders);

		if (shouldAddDecimals) {
			folders.push(...detailFolders);
			folders.push(...detailHardFolders);
		}

		return folders;
	});

	MutateCollection("tables.json", (tables) => {
		tables.push({
			title: `Level Folders (${versionPretty})`,
			inactive: true,
			tableID: `jubeat-Single-lv-${version}`,
			game: "jubeat",
			playtype: "Single",
			folders: levelFolders.map((e) => e.folderID),
			description: `Level Folders for jubeat ${versionPretty}. This table does not have separate folders for each decimal.`,
			default: false,
		});

		tables.push({
			title: `Hard Mode Level Folders (${versionPretty})`,
			inactive: true,
			tableID: `jubeat-Single-lvhd-${version}`,
			game: "jubeat",
			playtype: "Single",
			folders: levelHardFolders.map((e) => e.folderID),
			description: `Hard Mode Level Folders for jubeat ${versionPretty}. This table does not have separate folders for each decimal.`,
			default: false,
		});

		if (shouldAddDecimals) {
			tables.push({
				title: `Decimal Level Folders (${versionPretty})`,
				inactive: true,
				tableID: `jubeat-Single-declv-${version}`,
				game: "jubeat",
				playtype: "Single",
				folders: detailFolders.map((e) => e.folderID),
				description: `Decimal Level Folders for jubeat ${versionPretty}.`,
				default: false,
			});

			tables.push({
				title: `Hard Mode Decimal Level Folders (${versionPretty})`,
				inactive: true,
				tableID: `jubeat-Single-declvhd-${version}`,
				game: "jubeat",
				playtype: "Single",
				folders: detailHardFolders.map((e) => e.folderID),
				description: `Hard Mode Decimal Level Folders for jubeat ${versionPretty}.`,
				default: false,
			});
		}

		return tables;
	});
}
