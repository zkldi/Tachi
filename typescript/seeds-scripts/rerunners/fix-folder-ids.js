import { log as logger } from "../log.ts";
import { CreateFolderID, MutateCollection } from "../util.js";

MutateCollection("folders.json", (folders) => {
	logger.info("Updating Folders.");

	for (const folder of folders) {
		if(folder.id === undefined || !folder.id.startsWith("F")) {
			folder.id = CreateFolderID();
			logger.info(`Updating ${folder.slug}`);
		}
	}

	return folders;
});
