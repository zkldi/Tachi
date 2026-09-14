import { log as logger } from "../log.ts";
import { CreateFolderID, CreateRandomLegacyFolderID, MutateCollection } from "../util.js";
import { SEEDS_FolderDocument } from "tachi-common";

MutateCollection("folders.json", (folders: SEEDS_FolderDocument[]) => {
	logger.info("Updating Folders.");

	for (const folder of folders) {
		if (folder.id === undefined || !folder.id.startsWith("F")) {
			folder.id = CreateFolderID();
			folder.legacyFolderID = CreateRandomLegacyFolderID();
			logger.info(`Updating ${folder.slug}`);
		}
	}

	return folders;
});
