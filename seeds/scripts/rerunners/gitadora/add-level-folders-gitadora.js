/* eslint-disable no-loop-func */
const { MutateCollection, CreateFolderID } = require("../../util");
const { PrettyVersions } = require("tachi-common/config/versions");

function CreateFolder(criteria, playtype, title) {
	const f = {
		game: "gitadora",
		playtype,
		data: criteria,
		searchTerms: [],
		title,
		type: "charts",
		inactive: false,
	};

	const folderID = CreateFolderID(f.data, f.game, f.playtype);

	f.folderID = folderID;

	return f;
}

const version = "konaste";

const versionPretty = PrettyVersions["gitadora:Gita"][version];
const gitaFolders = [];
const doraFolders = [];

for (const level of [1, 2, 3, 4]) {
	const gitaFolder = CreateFolder(
		{ levelNum: { "~gte": level, "~lt": level + 1 }, versions: version },
		"Gita",
		`Level ${level}.00 - ${level}.99 (${versionPretty})`
	);
	const doraFolder = CreateFolder(
		{ levelNum: { "~gte": level, "~lt": level + 1 }, versions: version },
		"Dora",
		`Level ${level}.00 - ${level}.99 (${versionPretty})`
	);

	gitaFolders.push(gitaFolder);
	doraFolders.push(doraFolder);
}

for (const level of [5, 6, 7, 8, 9]) {
	const gitaFolder = CreateFolder(
		{ levelNum: { "~gte": level, "~lt": level + 0.5 }, versions: version },
		"Gita",
		`Level ${level}.00 - ${level}.49 (${versionPretty})`
	);
	const doraFolder = CreateFolder(
		{ levelNum: { "~gte": level, "~lt": level + 0.5 }, versions: version },
		"Dora",
		`Level ${level}.00 - ${level}.49 (${versionPretty})`
	);

	const gitaFolder2 = CreateFolder(
		{ levelNum: { "~gte": level + 0.5, "~lt": level + 1 }, versions: version },
		"Gita",
		`Level ${level}.50 - ${level}.99 (${versionPretty})`
	);
	const doraFolder2 = CreateFolder(
		{ levelNum: { "~gte": level + 0.5, "~lt": level + 1 }, versions: version },
		"Dora",
		`Level ${level}.50 - ${level}.99 (${versionPretty})`
	);

	gitaFolders.push(gitaFolder);
	gitaFolders.push(gitaFolder2);

	doraFolders.push(doraFolder);
	doraFolders.push(doraFolder2);
}

MutateCollection("folders.json", (folders) => {
	folders.push(...gitaFolders);
	folders.push(...doraFolders);

	return folders;
});

MutateCollection("tables.json", (tables) => {
	tables.push({
		title: `Level Folders (${versionPretty})`,
		inactive: false,
		tableID: `gitadora-Gita-lv-${version}`,
		game: "gitadora",
		playtype: "Gita",
		folders: gitaFolders.map((e) => e.folderID),
		description: `Level Folders for GITADORA ${versionPretty}.`,
		default: true,
	});

	tables.push({
		title: `Level Folders (${versionPretty})`,
		inactive: false,
		tableID: `gitadora-Dora-lv-${version}`,
		game: "gitadora",
		playtype: "Dora",
		folders: doraFolders.map((e) => e.folderID),
		description: `Level Folders for GITADORA ${versionPretty}.`,
		default: true,
	});

	return tables;
});
