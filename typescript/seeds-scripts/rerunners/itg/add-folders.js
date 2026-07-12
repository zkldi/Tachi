import { CreateFolderID, MutateCollection } from "../../util.js";

const folders = [];

for (let i = 1; i < 40; i++) {
	const levelFolders = [
		{
			data: {
				"data¬rankedLevel": i,
			},
			game: "itg",
			inactive: false,
			playtype: "Stamina",
			searchTerms: [],
			title: `Level ${i} Ranked`,
			type: "charts",
		},
		{
			data: {
				"data¬chartLevel": i,
			},
			game: "itg",
			inactive: false,
			playtype: "Stamina",
			searchTerms: [],
			title: `Level ${i} (w/ Unranked)`,
			type: "charts",
		},
		{
			data: {
				"data¬length": { "~gte": 60 * 16 },
				"data¬rankedLevel": i,
			},
			game: "itg",
			inactive: false,
			playtype: "Stamina",
			searchTerms: [],
			title: `Level ${i} (Ranked Marathons)`,
			type: "charts",
		},
		{
			data: {
				"data¬chartLevel": i,
				"data¬length": { "~gte": 60 * 16 },
			},
			game: "itg",
			inactive: false,
			playtype: "Stamina",
			searchTerms: [],
			title: `Level ${i} (All Marathons)`,
			type: "charts",
		},
	];

	for (const fld of levelFolders) {
		fld.folderID = CreateFolderID(fld.data, fld.game, fld.playtype);
	}

	folders.push(...levelFolders);
}

MutateCollection("folders.json", (v) => [...v, ...folders]);

MutateCollection("tables.json", (tbls) => {
	tbls.push({
		default: true,
		description: `Ranked charts for ITG. These are more reliably accurately rated than trusting what the charter thinks.`,
		folders: folders
			.filter((e) => "data¬rankedLevel" in e.data && !("data¬length" in e.data))
			.map((e) => e.folderID),
		game: "itg",
		inactive: false,
		playtype: "Stamina",
		tableID: "itg-Stamina-ranked",
		title: `ITG Stamina Ranked`,
	});

	tbls.push({
		default: false,
		description: `All charts for ITG. These may not be accurately rated.`,
		folders: folders
			.filter((e) => "data¬chartLevel" in e.data && !("data¬length" in e.data))
			.map((e) => e.folderID),
		game: "itg",
		inactive: false,
		playtype: "Stamina",
		tableID: "itg-Stamina-any",
		title: `ITG Stamina (w/ Unranked)`,
	});

	tbls.push({
		default: true,
		description: `Ranked marathons for ITG. These are more reliably accurately rated than trusting what the charter thinks.`,
		folders: folders
			.filter((e) => "data¬rankedLevel" in e.data && "data¬length" in e.data)
			.map((e) => e.folderID),
		game: "itg",
		inactive: false,
		playtype: "Stamina",
		tableID: "itg-Stamina-marathon-ranked",
		title: `ITG Stamina Ranked Marathons`,
	});

	tbls.push({
		default: false,
		description: `All marathons for ITG. These may not be accurately rated.`,
		folders: folders
			.filter((e) => "data¬chartLevel" in e.data && "data¬length" in e.data)
			.map((e) => e.folderID),
		game: "itg",
		inactive: false,
		playtype: "Stamina",
		tableID: "itg-Stamina-marathon-any",
		title: `ITG Stamina Marathons (w/ Unranked)`,
	});

	return tbls;
});
