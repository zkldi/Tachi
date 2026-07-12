import { IterateCollections } from "../util.js";

IterateCollections((data, filename) => {
	if (!filename.startsWith("songs-") && !filename.startsWith("charts-")) {
		return data;
	}

	for (const entry of data) {
		delete entry._added;
	}

	return data;
});
