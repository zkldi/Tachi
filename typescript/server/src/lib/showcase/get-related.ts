import type { ShowcaseStatDetails, V3Game } from "tachi-common";

import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import { log } from "#lib/log/log";
import { GetChartForIDGuaranteed, GetSongForIDGuaranteed } from "#utils/db";

export async function GetRelatedStatDocuments(stat: ShowcaseStatDetails, game: V3Game) {
	switch (stat.mode) {
		case "chart": {
			const chart = await GetChartForIDGuaranteed(stat.chartID);

			const song = await GetSongForIDGuaranteed(chart.song.id);

			return { song, chart };
		}

		case "folder": {
			const folder = await LoadFolderDocumentByGameAndSlug(game, stat.slug);

			if (!folder) {
				log.error({ stat }, `This stat refers to a folder that does not exist?`);
				throw new Error(`Stat refers to folder that no longer exists.`);
			}

			return { folder };
		}

		default: {
			log.error(
				{ stat },
				`Invalid stat - has nonsense stat.mode of ${(stat as ShowcaseStatDetails).mode}.`,
			);
			throw new Error(`Invalid stat.mode in stat?`);
		}
	}
}
