import { type SongDocument } from "tachi-common";

import { MutateCollection } from "../../util";
import { InsaneCharRebinds } from "./chars";

function fixString(string: string): string {
	return string
		.split("")
		.map((e) => InsaneCharRebinds[e] ?? e)
		.join("");
}

MutateCollection("songs-sdvx.json", (songs) => {
	const sdvxSongs = songs as Array<SongDocument<"sdvx">>;

	for (const song of sdvxSongs) {
		const fixedTitle = fixString(song.title);

		if (fixedTitle !== song.title) {
			if (!song.altTitles.includes(song.title)) {
				song.altTitles.push(song.title);
			}

			song.title = fixedTitle;
		}

		song.artist = fixString(song.artist);
	}

	return sdvxSongs;
});
